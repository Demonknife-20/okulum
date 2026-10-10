const fs = require('node:fs');
const path = require('node:path');
const { Pool, types } = require('pg');

// DATE sütunları JS Date'e dönüşmesin (saat dilimi kaymasın), düz metin gelsin.
types.setTypeParser(1082, value => value);

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL tanımlı değil.');

// Yerel bağlantıda SSL yok; Supabase/Render bağlantısında SSL zorunlu.
const local = /localhost|127\.0\.0\.1|\?host=\//.test(url);
const pool = new Pool({
  connectionString: url,
  max: Number(process.env.PG_POOL_SIZE || 5),
  idleTimeoutMillis: 30_000,
  ssl: local || process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
});
pool.on('error', error => console.error('Veritabanı boşta bağlantı hatası:', error.message));

const q = (text, params = []) => pool.query(text, params);

async function tx(work) {
  const client = await pool.connect();
  try {
    await client.query('begin');
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

async function migrate() {
  await q(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
}

module.exports = { q, tx, migrate, pool };
