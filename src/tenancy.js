const crypto = require('node:crypto');
const { migrate, migrateTenantSchema, pool, withTenant } = require('./db');

const RESERVED_SLUGS = new Set(['api', 'platform', 'robots', 'robots.txt', 'sitemap.xml', 'ads.txt', 'kullanim', 'hakkinda', 'gizlilik', 'healthz', 'assets', 'styles.css', 'app.js']);
const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

function slugify(value) {
  const slug = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ıİ]/g, 'i')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return SLUG.test(slug) && !RESERVED_SLUGS.has(slug) ? slug : 'okulum';
}

function schemaForSlug(slug) {
  if (!SLUG.test(slug) || RESERVED_SLUGS.has(slug)) throw new Error('Okul adresi geçersiz.');
  return `tenant_${crypto.createHash('sha256').update(slug).digest('hex').slice(0, 20)}`;
}

function validSlug(slug) {
  return typeof slug === 'string' && SLUG.test(slug) && !RESERVED_SLUGS.has(slug);
}

function schoolUrl(slug) {
  if (!validSlug(slug)) throw new Error('Okul adresi geçersiz.');
  return `/${encodeURIComponent(slug)}/`;
}

async function initializeTenancy() {
  await migrate();
  await pool.query('create schema if not exists platform');
  await pool.query(`create table if not exists platform.schools (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])?$'),
    schema_name text not null unique,
    name text not null,
    city text not null default '',
    year text not null default '',
    created_at timestamptz not null default now()
  )`);
  await pool.query(`create table if not exists platform.admins (
    id uuid primary key default gen_random_uuid(),
    username text not null unique,
    password_hash text not null,
    created_at timestamptz not null default now()
  )`);

  const { rows: registered } = await pool.query('select slug, schema_name from platform.schools order by created_at');
  if (!registered.length) {
    const { rows: schoolRows } = await pool.query('select name, city, year from public.school where id = 1');
    const { rows: userRows } = await pool.query('select count(*)::int as count from public.users');
    const legacy = schoolRows[0];
    const slug = legacy && userRows[0].count > 0 ? slugify(legacy.name) : 'okulum';
    const schema = legacy && userRows[0].count > 0 ? 'public' : schemaForSlug(slug);
    if (schema !== 'public') await migrateTenantSchema(schema);
    await pool.query(`insert into platform.schools (slug, schema_name, name, city, year)
      values ($1, $2, $3, $4, $5) on conflict (slug) do nothing`,
    [slug, schema, legacy?.name || 'Okulum', legacy?.city || '', legacy?.year || '']);
    registered.push({ slug, schema_name: schema });
  }

  for (const school of registered) await migrateTenantSchema(school.schema_name);
}

async function findSchoolBySlug(slug) {
  if (!validSlug(slug)) return null;
  const { rows: [school] } = await pool.query(
    'select id, slug, schema_name, name, city, year from platform.schools where slug = $1',
    [slug],
  );
  return school || null;
}

async function listSchools() {
  const { rows } = await pool.query(
    `select slug, name, city from platform.schools
      where name <> 'Okulum' or city <> '' or year <> ''
      order by lower(name), slug`,
  );
  return rows.map(school => ({ ...school, url: schoolUrl(school.slug) }));
}

async function syncTenantSchool(schema, school) {
  if (!schema) return;
  await pool.query(
    'update platform.schools set name = $2, city = $3, year = $4 where schema_name = $1',
    [schema, school.name, school.city, school.year],
  );
}

async function forEachTenant(work) {
  const { rows } = await pool.query('select schema_name from platform.schools order by created_at');
  const failures = [];
  for (const { schema_name: schema } of rows) {
    try {
      await withTenant(schema, () => work(schema));
    } catch (error) {
      console.error(`Okul işlemi başarısız (${schema}):`, error);
      failures.push(error);
    }
  }
  if (failures.length) throw new AggregateError(failures, `${failures.length} okul işlemi tamamlanamadı.`);
}

module.exports = { initializeTenancy, findSchoolBySlug, listSchools, schemaForSlug, validSlug, slugify, schoolUrl, syncTenantSchool, forEachTenant };
