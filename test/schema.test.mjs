// Sıfırdan kurulum: temel şema + tüm migrasyonlar sırayla ve yalnızca bir kez uygulanır.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const BASE = process.env.TEST_DATABASE_URL;
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const migrationFiles = fs.readdirSync(path.join(root, 'src', 'migrations')).filter(f => f.endsWith('.sql')).sort();

async function withDatabase(name, work) {
  const admin = new pg.Client({ connectionString: BASE.replace(/\/[^/?]+(\?|$)/, '/postgres$1') });
  await admin.connect();
  await admin.query(`drop database if exists ${name}`);
  await admin.query(`create database ${name}`);
  await admin.end();
  try {
    return await work(BASE.replace(/\/[^/?]+(\?|$)/, `/${name}$1`));
  } finally {
    const cleanup = new pg.Client({ connectionString: BASE.replace(/\/[^/?]+(\?|$)/, '/postgres$1') });
    await cleanup.connect();
    await cleanup.query(`drop database if exists ${name}`);
    await cleanup.end();
  }
}

const runMigrate = databaseUrl => execFileSync(process.execPath, ['-e',
  "require('./src/db').migrate().then(() => { require('./src/db').pool.end(); process.exit(0); }).catch(e => { console.error(e.message); process.exit(1); });",
], { cwd: root, env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' });

test('sıfırdan kurulum: tüm migrasyonlar sırayla uygulanır ve kayıt tablosu eşleşir', { timeout: 120000 }, async () => {
  await withDatabase('okulum_fresh_schema', async url => {
    runMigrate(url);
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    const { rows } = await client.query('select name from schema_migrations order by name');
    assert.deepEqual(rows.map(r => r.name), ['0000_baseline', ...migrationFiles.map(f => f.replace(/\.sql$/, ''))]);
    // Yeniden çalıştırma: hiçbir migrasyon ikinci kez uygulanmaz
    runMigrate(url);
    const again = await client.query('select count(*)::int as n from schema_migrations');
    assert.equal(again.rows[0].n, rows.length);
    await client.end();
  });
});
