const fs = require('node:fs');
const path = require('node:path');
const { AsyncLocalStorage } = require('node:async_hooks');
const { Pool, types } = require('pg');

// DATE sütunları JS Date'e dönüşmesin (saat dilimi kaymasın), düz metin gelsin.
types.setTypeParser(1082, value => value);

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL tanımlı değil.');

// Yerel bağlantıda SSL yok; Supabase/Render bağlantısında SSL zorunlu.
const local = /localhost|127\.0\.0\.1|\?host=\//.test(url);
const pool = new Pool({
  connectionString: url,
  max: Number(process.env.PG_POOL_SIZE || 10),
  idleTimeoutMillis: 30_000,
  ssl: local || process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
});
pool.on('error', error => console.error('Veritabanı boşta bağlantı hatası:', error.message));

const tenantContext = new AsyncLocalStorage();
const schemaPattern = /^(public|tenant_[a-f0-9]{20})$/;

function withTenant(schema, work) {
  if (!schemaPattern.test(schema)) throw new Error('Geçersiz okul veritabanı şeması.');
  return tenantContext.run(schema, work);
}
const currentTenantSchema = () => tenantContext.getStore() || null;

async function setTenantSearchPath(client, schema) {
  if (schema) await client.query('select set_config(\'search_path\', $1, true)', [schema]);
}

async function q(text, params = []) {
  const schema = tenantContext.getStore();
  if (!schema) return pool.query(text, params);
  const client = await pool.connect();
  try {
    await client.query('begin');
    await setTenantSearchPath(client, schema);
    const result = await client.query(text, params);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function tx(work) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await setTenantSearchPath(client, tenantContext.getStore());
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// Sürümlü migrasyonlar: temel şema (schema.sql) ilk kez uygulanır, ardından src/migrations/ klasöründeki
// her .sql dosyası sıra numarasına göre YALNIZCA BİR KEZ uygulanır ve schema_migrations tablosuna kaydedilir.
// Yeni bir değişiklik için src/migrations/NNNN_aciklama.sql dosyası ekleyin (NNNN bir önceki numaradan büyük olmalı).
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function migrate() {
  await q('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
  const { rows } = await q('select name from schema_migrations');
  const applied = new Set(rows.map(row => row.name));
  const steps = [['0000_baseline', fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')]];
  if (fs.existsSync(MIGRATIONS_DIR)) {
    for (const file of fs.readdirSync(MIGRATIONS_DIR).filter(name => name.endsWith('.sql')).sort()) {
      steps.push([file.replace(/\.sql$/, ''), fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')]);
    }
  }
  for (const [name, sql] of steps) {
    if (applied.has(name)) continue;
    await tx(async client => {
      await client.query(sql);
      await client.query('insert into schema_migrations (name) values ($1)', [name]);
    });
    console.log(`Migrasyon uygulandı: ${name}`);
  }
}

async function migrateTenantSchema(schema) {
  if (!schemaPattern.test(schema)) throw new Error('Geçersiz okul veritabanı şeması.');
  if (schema !== 'public') await pool.query(`create schema if not exists "${schema}"`);
  const client = await pool.connect();
  try {
    await client.query('begin');
    await setTenantSearchPath(client, schema);
    await client.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  const { rows } = await withTenant(schema, () => q('select name from schema_migrations'));
  const applied = new Set(rows.map(row => row.name));
  const steps = [['0000_baseline', fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')]];
  if (fs.existsSync(MIGRATIONS_DIR)) {
    for (const file of fs.readdirSync(MIGRATIONS_DIR).filter(name => name.endsWith('.sql')).sort()) {
      steps.push([file.replace(/\.sql$/, ''), fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')]);
    }
  }
  for (const [name, sql] of steps) {
    if (applied.has(name)) continue;
    await withTenant(schema, () => tx(async scoped => {
      await scoped.query(sql);
      await scoped.query('insert into schema_migrations (name) values ($1)', [name]);
    }));
    console.log(`Okul şeması migrasyonu uygulandı (${schema}): ${name}`);
  }
}

module.exports = { q, tx, migrate, migrateTenantSchema, withTenant, currentTenantSchema, pool };
