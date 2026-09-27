import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const { Pool } = pg;
const scriptDir = dirname(fileURLToPath(import.meta.url));
const apiDir = resolve(scriptDir, '..');

dotenv.config({
  path: [resolve(apiDir, '.env.local'), resolve(apiDir, '.env')],
});

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required. Configure apps/api/.env.local first.',
  );
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function assert(condition, message) {
  if (!condition) throw new Error(`검증 실패: ${message}`);
}

async function scalar(sql) {
  const result = await pool.query(sql);
  return Number(Object.values(result.rows[0])[0]);
}

async function main() {
  const postgis = await pool.query('SELECT PostGIS_Version() AS version');
  console.log(`PostGIS: ${postgis.rows[0].version}`);

  const storeCount = await scalar('SELECT COUNT(*) FROM store_commercial');
  const storeAreas = await scalar(
    'SELECT COUNT(DISTINCT trdar_cd) FROM store_commercial',
  );
  const storeIndustries = await scalar(
    'SELECT COUNT(DISTINCT svc_induty_cd) FROM store_commercial',
  );
  const storeQuarters = await pool.query(`
    SELECT stdr_yyqu_cd, COUNT(*)::int AS count
    FROM store_commercial
    GROUP BY stdr_yyqu_cd
    ORDER BY stdr_yyqu_cd
  `);

  console.log(
    `store_commercial: ${storeCount.toLocaleString()}행, 상권 ${storeAreas}, 업종 ${storeIndustries}`,
  );
  console.table(storeQuarters.rows);
  assert(storeCount === 306889, `점포 행 수가 306,889가 아님 (${storeCount})`);
  assert(storeAreas === 1650, `점포 상권 수가 1,650이 아님 (${storeAreas})`);
  assert(
    storeIndustries === 100,
    `점포 업종 수가 100이 아님 (${storeIndustries})`,
  );
  assert(
    storeQuarters.rows.map((row) => row.stdr_yyqu_cd).join(',') ===
      '20241,20242,20243,20244',
    '점포 분기 범위가 예상과 다름',
  );

  const changeCount = await scalar(
    'SELECT COUNT(*) FROM commercial_change_commercial',
  );
  const changeAreas = await scalar(
    'SELECT COUNT(DISTINCT trdar_cd) FROM commercial_change_commercial',
  );
  const changeRange = await pool.query(`
    SELECT MIN(stdr_yyqu_cd) AS min_quarter, MAX(stdr_yyqu_cd) AS max_quarter
    FROM commercial_change_commercial
  `);
  console.log(
    `commercial_change_commercial: ${changeCount.toLocaleString()}행, 상권 ${changeAreas}, ${changeRange.rows[0].min_quarter}~${changeRange.rows[0].max_quarter}`,
  );
  assert(
    changeCount === 44550,
    `상권변화 행 수가 44,550이 아님 (${changeCount})`,
  );
  assert(
    changeAreas === 1650,
    `상권변화 상권 수가 1,650이 아님 (${changeAreas})`,
  );

  const buildingCount = await scalar(
    'SELECT COUNT(*) FROM seoul_commercial_store_info',
  );
  const geometryCount = await scalar(
    'SELECT COUNT(*) FROM seoul_commercial_store_info WHERE geom IS NOT NULL',
  );
  console.log(
    `seoul_commercial_store_info: ${buildingCount.toLocaleString()}행, geometry ${geometryCount.toLocaleString()}건`,
  );
  assert(
    buildingCount >= 500000,
    `상가 위치 데이터가 50만 행 미만 (${buildingCount})`,
  );
  assert(
    geometryCount / buildingCount >= 0.99,
    `유효 geometry 비율이 99% 미만 (${((geometryCount / buildingCount) * 100).toFixed(2)}%)`,
  );

  for (const table of [
    'rent_small_shop',
    'rent_medium_large_shop',
    'rent_aggregate_shop',
  ]) {
    const count = await scalar(`SELECT COUNT(*) FROM ${table}`);
    console.log(`${table}: ${count}행`);
    assert(count > 0, `${table}이 비어 있음`);
  }

  const sample = await pool.query(`
    SELECT trdar_cd, MAX(trdar_cd_nm) AS name, SUM(stor_co)::int AS stores
    FROM store_commercial
    WHERE stdr_yyqu_cd = '20244'
    GROUP BY trdar_cd
    ORDER BY stores DESC
    LIMIT 3
  `);
  console.table(sample.rows);
  console.log('DB 적재 검증 완료');
}

try {
  await main();
} finally {
  await pool.end();
}
