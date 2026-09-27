import { createReadStream } from 'node:fs';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import iconv from 'iconv-lite';
import pg from 'pg';
import { parse } from 'csv-parse';

const { Pool } = pg;
const scriptDir = dirname(fileURLToPath(import.meta.url));
const apiDir = resolve(scriptDir, '..');
const repoRoot = resolve(apiDir, '../..');
const rawDataDir = resolve(repoRoot, 'data/raw');
const errorReportPath = resolve(apiDir, '.tmp/import-errors.jsonl');

dotenv.config({
  path: [resolve(apiDir, '.env.local'), resolve(apiDir, '.env')],
});

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required. Configure apps/api/.env.local first.',
  );
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const errors = [];

const fileNames = {
  store: '서울시_상권분석서비스(점포-상권)_2024년.csv',
  change: '서울시_상권분석서비스(상권변화지표-상권).csv',
  buildingStore: '소상공인시장진흥공단_상가(상권)정보_서울_202510.csv',
  rentSmall: '임대동향_층별임대료_및_층별효용비율(2024년3분기)_소규모_상가.csv',
  rentMedium:
    '임대동향_층별임대료_및_층별효용비율(2024년3분기)_중대형_상가.csv',
  rentAggregate:
    '임대동향_층별임대료_및_층별효용비율(2024년3분기)_집합_상가.csv',
};

function normalizeName(value) {
  return value.normalize('NFC');
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path)));
    else files.push(path);
  }

  return files;
}

async function resolveRawFile(expectedName) {
  const files = await listFiles(rawDataDir);
  const normalizedExpected = normalizeName(expectedName);
  const match = files.find(
    (path) => normalizeName(path.split('/').at(-1)) === normalizedExpected,
  );

  if (!match) throw new Error(`Raw data file not found: ${expectedName}`);
  return match;
}

function nullableText(value) {
  const text = value == null ? '' : String(value).trim();
  return text === '' ? null : text;
}

function requiredText(value, field) {
  const text = nullableText(value);
  if (text === null) throw new Error(`${field} is empty`);
  return text;
}

function numeric(value, field, { required = false, integer = false } = {}) {
  const text = nullableText(value)?.replaceAll(',', '') ?? null;
  if (text === null) {
    if (required) throw new Error(`${field} is empty`);
    return null;
  }

  const number = Number(text);
  if (!Number.isFinite(number))
    throw new Error(`${field} is not numeric: ${text}`);
  return integer ? Math.trunc(number) : number;
}

function addError(dataset, row, message) {
  if (errors.length < 1000) errors.push({ dataset, row, message });
}

function csvObjectStream(path, dataset) {
  return createReadStream(path)
    .pipe(iconv.decodeStream('cp949'))
    .pipe(
      parse({
        columns: true,
        bom: true,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true,
        skip_records_with_error: true,
        on_skip: (error) => addError(dataset, error.lines, error.message),
      }),
    );
}

function csvRowStream(path, dataset) {
  return createReadStream(path)
    .pipe(iconv.decodeStream('cp949'))
    .pipe(
      parse({
        bom: true,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true,
        skip_records_with_error: true,
        on_skip: (error) => addError(dataset, error.lines, error.message),
      }),
    );
}

function quoteIdentifier(identifier) {
  if (!/^[a-z_][a-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

async function insertBatch(client, table, columns, rows) {
  if (rows.length === 0) return 0;

  const values = [];
  const placeholders = rows.map((row, rowIndex) => {
    const offset = rowIndex * columns.length;
    columns.forEach((column) => values.push(row[column] ?? null));
    return `(${columns.map((_, index) => `$${offset + index + 1}`).join(',')})`;
  });

  const result = await client.query(
    `INSERT INTO ${quoteIdentifier(table)} (${columns
      .map(quoteIdentifier)
      .join(',')}) VALUES ${placeholders.join(',')} ON CONFLICT DO NOTHING`,
    values,
  );
  return result.rowCount ?? 0;
}

async function replaceFromCsv({
  dataset,
  path,
  table,
  columns,
  mapRecord,
  batchSize = 750,
}) {
  const client = await pool.connect();
  let parsed = 0;
  let accepted = 0;
  let inserted = 0;
  let batch = [];

  console.log(`\n[${dataset}] ${table} 적재 시작`);
  try {
    await client.query('BEGIN');
    await client.query(`TRUNCATE TABLE ${quoteIdentifier(table)}`);

    for await (const record of csvObjectStream(path, dataset)) {
      parsed += 1;
      try {
        batch.push(mapRecord(record, parsed + 1));
        accepted += 1;
      } catch (error) {
        addError(dataset, parsed + 1, error.message);
      }

      if (batch.length >= batchSize) {
        inserted += await insertBatch(client, table, columns, batch);
        batch = [];
      }

      if (parsed % 25000 === 0) {
        console.log(`[${dataset}] ${parsed.toLocaleString()}행 처리`);
      }
    }

    inserted += await insertBatch(client, table, columns, batch);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  console.log(
    `[${dataset}] 파싱 ${parsed.toLocaleString()} / 유효 ${accepted.toLocaleString()} / 적재 ${inserted.toLocaleString()}`,
  );
  return { parsed, accepted, inserted };
}

const storeColumns = [
  'stdr_yyqu_cd',
  'trdar_se_cd',
  'trdar_se_cd_nm',
  'trdar_cd',
  'trdar_cd_nm',
  'svc_induty_cd',
  'svc_induty_cd_nm',
  'stor_co',
  'similr_induty_stor_co',
  'opbiz_rt',
  'opbiz_stor_co',
  'clsbiz_rt',
  'clsbiz_stor_co',
  'frc_stor_co',
];

function mapStore(record) {
  return {
    stdr_yyqu_cd: requiredText(record['기준_년분기_코드'], '기준_년분기_코드'),
    trdar_se_cd: requiredText(record['상권_구분_코드'], '상권_구분_코드'),
    trdar_se_cd_nm: requiredText(
      record['상권_구분_코드_명'],
      '상권_구분_코드_명',
    ),
    trdar_cd: requiredText(record['상권_코드'], '상권_코드'),
    trdar_cd_nm: requiredText(record['상권_코드_명'], '상권_코드_명'),
    svc_induty_cd: requiredText(record['서비스_업종_코드'], '서비스_업종_코드'),
    svc_induty_cd_nm: requiredText(
      record['서비스_업종_코드_명'],
      '서비스_업종_코드_명',
    ),
    stor_co: numeric(record['점포_수'], '점포_수', {
      required: true,
      integer: true,
    }),
    similr_induty_stor_co: numeric(
      record['유사_업종_점포_수'],
      '유사_업종_점포_수',
      {
        required: true,
        integer: true,
      },
    ),
    opbiz_rt: numeric(record['개업_율'], '개업_율', { required: true }),
    opbiz_stor_co: numeric(record['개업_점포_수'], '개업_점포_수', {
      required: true,
      integer: true,
    }),
    clsbiz_rt: numeric(record['폐업_률'], '폐업_률', { required: true }),
    clsbiz_stor_co: numeric(record['폐업_점포_수'], '폐업_점포_수', {
      required: true,
      integer: true,
    }),
    frc_stor_co: numeric(record['프랜차이즈_점포_수'], '프랜차이즈_점포_수', {
      required: true,
      integer: true,
    }),
  };
}

const changeColumns = [
  'stdr_yyqu_cd',
  'trdar_se_cd',
  'trdar_se_cd_nm',
  'trdar_cd',
  'trdar_cd_nm',
  'trdar_chnge_ix',
  'trdar_chnge_ix_nm',
  'opr_sale_mt_avrg',
  'cls_sale_mt_avrg',
  'su_opr_sale_mt_avrg',
  'su_cls_sale_mt_avrg',
];

function mapChange(record) {
  return {
    stdr_yyqu_cd: requiredText(record['기준_년분기_코드'], '기준_년분기_코드'),
    trdar_se_cd: requiredText(record['상권_구분_코드'], '상권_구분_코드'),
    trdar_se_cd_nm: requiredText(
      record['상권_구분_코드_명'],
      '상권_구분_코드_명',
    ),
    trdar_cd: requiredText(record['상권_코드'], '상권_코드'),
    trdar_cd_nm: requiredText(record['상권_코드_명'], '상권_코드_명'),
    trdar_chnge_ix: requiredText(record['상권_변화_지표'], '상권_변화_지표'),
    trdar_chnge_ix_nm: requiredText(
      record['상권_변화_지표_명'],
      '상권_변화_지표_명',
    ),
    opr_sale_mt_avrg: numeric(
      record['운영_영업_개월_평균'],
      '운영_영업_개월_평균',
      {
        required: true,
        integer: true,
      },
    ),
    cls_sale_mt_avrg: numeric(
      record['폐업_영업_개월_평균'],
      '폐업_영업_개월_평균',
      {
        required: true,
        integer: true,
      },
    ),
    su_opr_sale_mt_avrg: numeric(
      record['서울_운영_영업_개월_평균'],
      '서울_운영_영업_개월_평균',
      { required: true, integer: true },
    ),
    su_cls_sale_mt_avrg: numeric(
      record['서울_폐업_영업_개월_평균'],
      '서울_폐업_영업_개월_평균',
      { required: true, integer: true },
    ),
  };
}

const buildingStoreColumns = [
  'store_id',
  'store_name',
  'branch_name',
  'business_category_large_code',
  'business_category_large_name',
  'business_category_medium_code',
  'business_category_medium_name',
  'business_category_small_code',
  'business_category_small_name',
  'ksic_code',
  'ksic_name',
  'sido_code',
  'sido_name',
  'sigungu_code',
  'sigungu_name',
  'administrative_dong_code',
  'administrative_dong_name',
  'legal_dong_code',
  'legal_dong_name',
  'lot_code',
  'land_classification_code',
  'land_classification_name',
  'lot_main_no',
  'lot_sub_no',
  'lot_address',
  'road_name_code',
  'road_name',
  'building_main_no',
  'building_sub_no',
  'building_management_no',
  'building_name',
  'road_name_address',
  'old_zip_code',
  'new_zip_code',
  'dong_info',
  'floor_info',
  'unit_info',
  'longitude',
  'latitude',
];

function mapBuildingStore(record) {
  const longitude = numeric(record['경도'], '경도');
  const latitude = numeric(record['위도'], '위도');
  const validCoordinate =
    longitude !== null &&
    latitude !== null &&
    longitude >= 120 &&
    longitude <= 140 &&
    latitude >= 30 &&
    latitude <= 40;

  return {
    store_id: requiredText(record['상가업소번호'], '상가업소번호'),
    store_name: nullableText(record['상호명']),
    branch_name: nullableText(record['지점명']),
    business_category_large_code: nullableText(record['상권업종대분류코드']),
    business_category_large_name: nullableText(record['상권업종대분류명']),
    business_category_medium_code: nullableText(record['상권업종중분류코드']),
    business_category_medium_name: nullableText(record['상권업종중분류명']),
    business_category_small_code: nullableText(record['상권업종소분류코드']),
    business_category_small_name: nullableText(record['상권업종소분류명']),
    ksic_code: nullableText(record['표준산업분류코드']),
    ksic_name: nullableText(record['표준산업분류명']),
    sido_code: nullableText(record['시도코드']),
    sido_name: nullableText(record['시도명']),
    sigungu_code: nullableText(record['시군구코드']),
    sigungu_name: nullableText(record['시군구명']),
    administrative_dong_code: nullableText(record['행정동코드']),
    administrative_dong_name: nullableText(record['행정동명']),
    legal_dong_code: nullableText(record['법정동코드']),
    legal_dong_name: nullableText(record['법정동명']),
    lot_code: nullableText(record['지번코드']),
    land_classification_code: nullableText(record['대지구분코드']),
    land_classification_name: nullableText(record['대지구분명']),
    lot_main_no: nullableText(record['지번본번지']),
    lot_sub_no: nullableText(record['지번부번지']),
    lot_address: nullableText(record['지번주소']),
    road_name_code: nullableText(record['도로명코드']),
    road_name: nullableText(record['도로명']),
    building_main_no: nullableText(record['건물본번지']),
    building_sub_no: nullableText(record['건물부번지']),
    building_management_no: nullableText(record['건물관리번호']),
    building_name: nullableText(record['건물명']),
    road_name_address: nullableText(record['도로명주소']),
    old_zip_code: nullableText(record['구우편번호']),
    new_zip_code: nullableText(record['신우편번호']),
    dong_info: nullableText(record['동정보']),
    floor_info: nullableText(record['층정보']),
    unit_info: nullableText(record['호정보']),
    longitude: validCoordinate ? longitude : null,
    latitude: validCoordinate ? latitude : null,
  };
}

function parseQuarter(value) {
  const match = String(value ?? '').match(/^(\d{4})년\s*(\d)분기$/);
  return match ? Number(match[1]) * 10 + Number(match[2]) : null;
}

async function readRentRecords(path, dataset, supportedFloors) {
  const rows = [];
  for await (const row of csvRowStream(path, dataset)) rows.push(row);
  if (rows.length < 3) throw new Error(`${dataset}: header rows are missing`);

  const periods = rows[0];
  const floorNames = rows[1];
  const latestQuarter = Math.max(
    ...periods.map(parseQuarter).filter(Number.isFinite),
  );
  const quarterIndexes = periods
    .map((period, index) => ({ period: parseQuarter(period), index }))
    .filter(({ period }) => period === latestQuarter);
  const floorIndexes = new Map(
    quarterIndexes.map(({ index }) => [floorNames[index], index]),
  );
  const byRegion = new Map();

  for (let index = 2; index < rows.length; index += 1) {
    const row = rows[index];
    if (row[4] !== '임대료') continue;
    const region = nullableText(row[3]);
    if (!region) continue;

    const record = { gu_name: region };
    for (const [column, label] of Object.entries(supportedFloors)) {
      const valueIndex = floorIndexes.get(label);
      record[column] =
        valueIndex === undefined ? null : numeric(row[valueIndex], label);
    }
    byRegion.set(region, record);
  }

  const year = Math.floor(latestQuarter / 10);
  const quarter = latestQuarter % 10;
  console.log(
    `[${dataset}] ${year}년 ${quarter}분기, ${byRegion.size}개 지역 추출`,
  );
  return [...byRegion.values()];
}

async function replaceRows(table, columns, rows) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`TRUNCATE TABLE ${quoteIdentifier(table)}`);
    const inserted = await insertBatch(client, table, columns, rows);
    await client.query('COMMIT');
    console.log(`[rent] ${table}: ${inserted}행 적재`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function importRent(paths) {
  const smallFloors = { b1f: '지하1층', f1: '1층', f2: '2층' };
  const fullFloors = {
    b1f: '지하1층',
    f1: '1층',
    f2: '2층',
    f3: '3층',
    f4: '4층',
    f5: '5층',
    f6_plus: '6층이상',
  };
  const smallRows = await readRentRecords(
    paths.rentSmall,
    'rent-small',
    smallFloors,
  );
  const mediumRows = await readRentRecords(
    paths.rentMedium,
    'rent-medium',
    fullFloors,
  );
  const aggregateRows = await readRentRecords(
    paths.rentAggregate,
    'rent-aggregate',
    fullFloors,
  );

  await replaceRows(
    'rent_small_shop',
    ['gu_name', ...Object.keys(smallFloors)],
    smallRows,
  );
  await replaceRows(
    'rent_medium_large_shop',
    ['gu_name', ...Object.keys(fullFloors)],
    mediumRows,
  );
  await replaceRows(
    'rent_aggregate_shop',
    ['gu_name', ...Object.keys(fullFloors)],
    aggregateRows,
  );
}

async function createBuildingGeometry() {
  console.log('\n[building-store] PostGIS 좌표 생성');
  const result = await pool.query(`
    UPDATE seoul_commercial_store_info
    SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
    WHERE longitude IS NOT NULL AND latitude IS NOT NULL
  `);
  console.log(
    `[building-store] geometry ${result.rowCount.toLocaleString()}건 생성`,
  );
}

async function writeErrorReport() {
  if (errors.length === 0) return;
  await mkdir(dirname(errorReportPath), { recursive: true });
  await writeFile(
    errorReportPath,
    `${errors.map((error) => JSON.stringify(error)).join('\n')}\n`,
    'utf8',
  );
  console.warn(`오류 ${errors.length}건 기록: ${errorReportPath}`);
}

async function main() {
  const requested = new Set(
    (
      process.argv.find((arg) => arg.startsWith('--only='))?.split('=')[1] ??
      'store,change,building-store,rent'
    )
      .split(',')
      .map((value) => value.trim()),
  );
  const paths = Object.fromEntries(
    await Promise.all(
      Object.entries(fileNames).map(async ([key, name]) => [
        key,
        await resolveRawFile(name),
      ]),
    ),
  );

  await pool.query('SELECT 1');
  console.log(`원본 데이터: ${rawDataDir}`);

  if (requested.has('store')) {
    await replaceFromCsv({
      dataset: 'store',
      path: paths.store,
      table: 'store_commercial',
      columns: storeColumns,
      mapRecord: mapStore,
    });
  }

  if (requested.has('change')) {
    await replaceFromCsv({
      dataset: 'commercial-change',
      path: paths.change,
      table: 'commercial_change_commercial',
      columns: changeColumns,
      mapRecord: mapChange,
    });
  }

  if (requested.has('building-store')) {
    await replaceFromCsv({
      dataset: 'building-store',
      path: paths.buildingStore,
      table: 'seoul_commercial_store_info',
      columns: buildingStoreColumns,
      mapRecord: mapBuildingStore,
      batchSize: 500,
    });
    await createBuildingGeometry();
  }

  if (requested.has('rent')) await importRent(paths);

  await pool.query(`
    ANALYZE store_commercial;
    ANALYZE commercial_change_commercial;
    ANALYZE seoul_commercial_store_info;
  `);
  await writeErrorReport();
  console.log('\nCSV 적재 완료');
}

try {
  await main();
} finally {
  await pool.end();
}
