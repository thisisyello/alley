import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export const LATEST_QUARTER = '20253';
import {
  AdministrativeAreaResult,
  CommercialAreaResult,
  GuAreaResult,
} from './dto/market.interface';
import { BuildingStore, Prisma } from 'generated/prisma/client';

@Injectable()
export class MarketRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findCommercialArea(
    lat: number,
    lng: number,
  ): Promise<CommercialAreaResult | null> {
    const result = await this.prisma.$queryRaw<CommercialAreaResult[]>`
      SELECT trdar_cd as "trdar_cd", TRDAR_CD_N as "trdar_cd_nm", TRDAR_SE_1 as "TRDAR_SE_1"
      FROM seoul_commercial_area_grid
      WHERE ST_Intersects(geom, ST_SetSRID(ST_Point(${lng}, ${lat}), 4326))
      LIMIT 1
    `;
    return result[0] || null;
  }

  async findAdministrativeDistrict(
    lat: number,
    lng: number,
  ): Promise<AdministrativeAreaResult | null> {
    const result = await this.prisma.$queryRaw<AdministrativeAreaResult[]>`
      SELECT adstrd_cd as "adstrd_cd", adm_nm as "adstrd_nm"
      FROM admin_area_dong
      WHERE ST_Intersects(
        ST_SetSRID(
          ST_GeomFromGeoJSON(
            jsonb_build_object(
              'type',
              CASE WHEN jsonb_typeof(polygons #> '{0,0,0}') = 'number' THEN 'Polygon' ELSE 'MultiPolygon' END,
              'coordinates',
              polygons
            )
          ),
          5179
        ),
        ST_Transform(ST_SetSRID(ST_Point(${lng}, ${lat}), 4326), 5179)
      )
      LIMIT 1
    `;
    return result[0] || null;
  }

  // 상권 매출 추이 조회 (분기별 업종 합계)
  async getCommercialRevenueTrend(code: string, industryCode?: string) {
    return this.prisma.salesCommercial.groupBy({
      by: ['stdr_yyqu_cd'],
      where: { trdar_cd: code, svc_induty_cd: industryCode },
      _sum: {
        thsmon_selng_amt: true,
        tmzon_00_06_selng_amt: true,
        tmzon_06_11_selng_amt: true,
        tmzon_11_14_selng_amt: true,
        tmzon_14_17_selng_amt: true,
        tmzon_17_21_selng_amt: true,
        tmzon_21_24_selng_amt: true,
        mon_selng_amt: true,
        tues_selng_amt: true,
        wed_selng_amt: true,
        thur_selng_amt: true,
        fri_selng_amt: true,
        sat_selng_amt: true,
        sun_selng_amt: true,
        ml_selng_amt: true,
        fml_selng_amt: true,
        agrde_10_selng_amt: true,
        agrde_20_selng_amt: true,
        agrde_30_selng_amt: true,
        agrde_40_selng_amt: true,
        agrde_50_selng_amt: true,
        agrde_60_above_selng_amt: true,
      },
      orderBy: { stdr_yyqu_cd: 'desc' },
      take: 5,
    });
  }

  // 행정동 매출 추이 조회 (분기별 업종 합계)
  async getAdminDongRevenueTrend(code: string, industryCode?: string) {
    return this.prisma.salesDong.groupBy({
      by: ['stdr_yyqu_cd'],
      where: { adstrd_cd: code, svc_induty_cd: industryCode },
      _sum: {
        thsmon_selng_amt: true,
        tmzon_00_06_selng_amt: true,
        tmzon_06_11_selng_amt: true,
        tmzon_11_14_selng_amt: true,
        tmzon_14_17_selng_amt: true,
        tmzon_17_21_selng_amt: true,
        tmzon_21_24_selng_amt: true,
        mon_selng_amt: true,
        tues_selng_amt: true,
        wed_selng_amt: true,
        thur_selng_amt: true,
        fri_selng_amt: true,
        sat_selng_amt: true,
        sun_selng_amt: true,
        ml_selng_amt: true,
        fml_selng_amt: true,
        agrde_10_selng_amt: true,
        agrde_20_selng_amt: true,
        agrde_30_selng_amt: true,
        agrde_40_selng_amt: true,
        agrde_50_selng_amt: true,
        agrde_60_above_selng_amt: true,
      },
      orderBy: { stdr_yyqu_cd: 'desc' },
      take: 5,
    });
  }

  // =====================================
  // 행정구 (Gu) 관련 메서드
  // =====================================

  /**
   * PostGIS: 좌표로 행정구 찾기
   * @param lat 위도
   * @param lng 경도
   * @returns 시군구 코드와 이름
   */
  async findAdministrativeGu(
    lat: number,
    lng: number,
  ): Promise<GuAreaResult | null> {
    // signgu_cd가 실제 행정구 코드 (text 타입)
    const result = await this.prisma.$queryRaw<GuAreaResult[]>`
      SELECT 
        signgu_cd as "signgu_cd", 
        adm_nm as "signgu_nm"
      FROM admin_area_gu
      WHERE ST_Intersects(
        ST_SetSRID(
          ST_GeomFromGeoJSON(
            jsonb_build_object(
              'type',
              CASE WHEN jsonb_typeof(polygons #> '{0,0,0}') = 'number' THEN 'Polygon' ELSE 'MultiPolygon' END,
              'coordinates',
              polygons
            )
          ),
          4326
        ),
        ST_SetSRID(ST_Point(${lng}, ${lat}), 4326)
      )
      LIMIT 1
    `;
    return result[0] || null;
  }

  /**
   * 행정구 매출 추이 조회 (분기별 업종 합계)
   * @param code 시군구 코드 (signgu_cd)
   */
  async getAdminGuRevenueTrend(code: string, industryCode?: string) {
    return this.prisma.salesGu.groupBy({
      by: ['stdr_yyqu_cd'],
      where: { signgu_cd: code, svc_induty_cd: industryCode },
      _sum: {
        thsmon_selng_amt: true,
        tmzon_00_06_selng_amt: true,
        tmzon_06_11_selng_amt: true,
        tmzon_11_14_selng_amt: true,
        tmzon_14_17_selng_amt: true,
        tmzon_17_21_selng_amt: true,
        tmzon_21_24_selng_amt: true,
        mon_selng_amt: true,
        tues_selng_amt: true,
        wed_selng_amt: true,
        thur_selng_amt: true,
        fri_selng_amt: true,
        sat_selng_amt: true,
        sun_selng_amt: true,
        ml_selng_amt: true,
        fml_selng_amt: true,
        agrde_10_selng_amt: true,
        agrde_20_selng_amt: true,
        agrde_30_selng_amt: true,
        agrde_40_selng_amt: true,
        agrde_50_selng_amt: true,
        agrde_60_above_selng_amt: true,
      },
      orderBy: { stdr_yyqu_cd: 'desc' },
      take: 5,
    });
  }

  async getCommercialStoreStats(code: string, industryCode?: string) {
    return this.prisma.storeCommercial.aggregate({
      where: {
        trdar_cd: code,
        svc_induty_cd: industryCode,
        stdr_yyqu_cd: LATEST_QUARTER,
      },
      _sum: {
        stor_co: true,
        opbiz_stor_co: true,
        clsbiz_stor_co: true,
        frc_stor_co: true,
        similr_induty_stor_co: true,
      },
      _max: { stdr_yyqu_cd: true },
    });
  }

  async getAdministrativeStoreStats(code: string, industryCode?: string) {
    return this.prisma.storeDong.aggregate({
      where: {
        adstrd_cd: code,
        svc_induty_cd: industryCode,
        stdr_yyqu_cd: LATEST_QUARTER,
      },
      _sum: {
        stor_co: true,
        opbiz_stor_co: true,
        clsbiz_stor_co: true,
        frc_stor_co: true,
        similr_induty_stor_co: true,
      },
      _max: { stdr_yyqu_cd: true },
    });
  }

  /**
   * 행정구 상점 통계 조회 (개업/폐업 건수)
   * @param code 시군구 코드 (signgu_cd)
   */
  async getGuStoreStats(code: string, industryCode?: string) {
    return this.prisma.storeGu.aggregate({
      where: {
        signgu_cd: code,
        svc_induty_cd: industryCode,
        stdr_yyqu_cd: LATEST_QUARTER,
      },
      _sum: {
        stor_co: true,
        opbiz_stor_co: true,
        clsbiz_stor_co: true,
        frc_stor_co: true,
        similr_induty_stor_co: true,
      },
      _max: { stdr_yyqu_cd: true },
    });
  }

  async findGuByCode(code: string): Promise<GuAreaResult | null> {
    const result = await this.prisma.areaGu.findUnique({
      where: { signgu_cd: code },
      select: { signgu_cd: true, signgu_nm: true },
    });
    if (!result) return null;
    return { signgu_cd: result.signgu_cd, signgu_nm: result.signgu_nm };
  }

  async findDongByCode(code: string): Promise<AdministrativeAreaResult | null> {
    const result = await this.prisma.areaDong.findUnique({
      where: { adstrd_cd: code },
      select: { adstrd_cd: true, adstrd_nm: true },
    });
    if (!result) return null;
    return { adstrd_cd: result.adstrd_cd, adstrd_nm: result.adstrd_nm };
  }

  /**
   * 상권 업종별 매출 Top 5 조회
   * @param code 상권 코드 (trdar_cd)
   * @returns 업종별 매출 합계 (내림차순 정렬)
   */
  async getCommercialTopIndustries(code: string) {
    return this.prisma.salesCommercial.groupBy({
      by: ['svc_induty_cd', 'svc_induty_cd_nm'],
      where: { trdar_cd: code, stdr_yyqu_cd: LATEST_QUARTER },
      _sum: {
        thsmon_selng_amt: true,
      },
      orderBy: {
        _sum: { thsmon_selng_amt: 'desc' },
      },
    });
  }

  /**
   * 행정동 업종별 매출 Top 5 조회
   * @param code 행정동 코드 (adstrd_cd)
   */
  async getDongTopIndustries(code: string) {
    return this.prisma.salesDong.groupBy({
      by: ['svc_induty_cd', 'svc_induty_cd_nm'],
      where: { adstrd_cd: code, stdr_yyqu_cd: LATEST_QUARTER },
      _sum: {
        thsmon_selng_amt: true,
      },
      orderBy: {
        _sum: { thsmon_selng_amt: 'desc' },
      },
    });
  }

  /**
   * 행정구 업종별 매출 Top 5 조회
   * @param code 시군구 코드 (signgu_cd)
   */
  async getGuTopIndustries(code: string) {
    return this.prisma.salesGu.groupBy({
      by: ['svc_induty_cd', 'svc_induty_cd_nm'],
      where: { signgu_cd: code, stdr_yyqu_cd: LATEST_QUARTER },
      _sum: {
        thsmon_selng_amt: true,
      },
      orderBy: {
        _sum: { thsmon_selng_amt: 'desc' },
      },
    });
  }

  // 다각형내 상가업소 조회
  async findStoresInPolygon(polygonWKT: string): Promise<BuildingStore[]> {
    const result = await this.prisma.$queryRaw<any[]>`
      SELECT *
      FROM seoul_commercial_store_info
      WHERE ST_Intersects(
        geom,
        ST_SetSRID(ST_GeomFromText(${polygonWKT}), 4326)
      )
    `;
    return result as BuildingStore[];
  }

  //사각형내 상가업소 조회
  async findStoresInRectangle({
    minLng,
    minLat,
    maxLng,
    maxLat,
    categorie,
  }: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
    categorie: string | null;
  }): Promise<BuildingStore[]> {
    const whereCategory = categorie
      ? Prisma.sql`AND business_category_large_code = ${categorie}`
      : Prisma.empty;

    const result = await this.prisma.$queryRaw<any[]>`
      SELECT seoul_commercial_store_info.*
      FROM seoul_commercial_store_info AS seoul_commercial_store_info
      WHERE seoul_commercial_store_info.geom && ST_MakeEnvelope(
          ${minLng},
          ${minLat},
          ${maxLng},
          ${maxLat},
          4326
      )
      ${whereCategory}
      
    `;
    return result as BuildingStore[];
  }

  /**
   * 업종 코드로 점포 위치 조회 (bbox 필터링 지원)
   *
   * 💡 DB 컬럼명 (prisma/models/building_store.prisma 참조):
   *   - longitude: 경도 (lng)
   *   - latitude: 위도 (lat)
   *   - store_name: 점포명
   *   - road_name_address: 도로명 주소
   *   - business_category_small_code: 소분류 업종 코드 (예: I21006 치킨)
   *
   * @param industryCode DB 업종 코드 (예: 'I21006' 치킨, 'I201' 한식)
   * @param bbox 선택적 바운딩 박스 (minLng, minLat, maxLng, maxLat)
   * @param limit 최대 반환 개수 (기본 100)
   * @returns 점포 위치 배열 [{lng, lat, name, address}]
   */
  async findStoresByIndustryCode({
    industryCode,
    bbox,
    limit = 100,
  }: {
    industryCode: string;
    bbox?: { minLng: number; minLat: number; maxLng: number; maxLat: number };
    limit?: number;
  }): Promise<{ lng: number; lat: number; name: string; address: string }[]> {
    // bbox가 있으면 공간 필터 추가
    const bboxFilter = bbox
      ? Prisma.sql`AND longitude >= ${bbox.minLng} AND longitude <= ${bbox.maxLng} 
                   AND latitude >= ${bbox.minLat} AND latitude <= ${bbox.maxLat}`
      : Prisma.empty;

    // 업종 코드 prefix 매칭 (I201 → I20101, I20102 등)
    const result = await this.prisma.$queryRaw<
      { lng: number; lat: number; name: string; address: string }[]
    >`
      SELECT 
        longitude as lng,
        latitude as lat,
        store_name as name,
        road_name_address as address
      FROM seoul_commercial_store_info
      WHERE business_category_small_code LIKE ${industryCode + '%'}
      ${bboxFilter}
      LIMIT ${limit}
    `;

    return result;
  }
  async findStoresByIndustryAndArea({
    industryCode,
    areaCode,
    level,
    limit = 1000,
  }: {
    industryCode: string;
    areaCode: string;
    level: string;
    limit?: number;
  }): Promise<{ lng: number; lat: number; name: string; address: string }[]> {
    console.log('[MarketRepository] findStoresByIndustryAndArea:', {
      industryCode,
      areaCode,
      level,
    });
    let result: { lng: number; lat: number; name: string; address: string }[] =
      [];

    if (level === 'commercial') {
      console.log('[DEBUG] Executing Commercial Area Query...');
      // 상권: seoul_commercial_area_grid (geom 존재, SRID 4326)
      try {
        result = await this.prisma.$queryRaw<
          { lng: number; lat: number; name: string; address: string }[]
        >`
          SELECT 
            s.longitude as lng,
            s.latitude as lat,
            s.store_name as name,
            s.road_name_address as address
          FROM seoul_commercial_store_info s
          JOIN seoul_commercial_area_grid a ON a.trdar_cd = ${areaCode}
          WHERE s.business_category_small_code LIKE ${industryCode + '%'}
            AND ST_Intersects(s.geom, a.geom)
          LIMIT ${limit}
        `;
        console.log(`[DEBUG] Commercial Stores Found: ${result.length}`);
      } catch (e) {
        console.error('[DEBUG] Commercial Query Failed:', e);
      }
    } else if (level === 'gu') {
      // 자치구: admin_area_gu (polygons JSON)
      // EPSG:5179 -> 4326 변환 필요
      result = await this.prisma.$queryRaw<
        { lng: number; lat: number; name: string; address: string }[]
      >`
        WITH area_geom AS (
          SELECT ST_Transform(
            ST_SetSRID(
              ST_GeomFromGeoJSON(
                jsonb_build_object(
                  'type',
                  CASE 
                    WHEN jsonb_typeof(polygons #> '{0,0,0}') = 'number' THEN 'Polygon' 
                    ELSE 'MultiPolygon' 
                  END,
                  'coordinates',
                  polygons
                )
              ),
              5179
            ),
            4326
          ) as geom
          FROM admin_area_gu
          WHERE signgu_cd = ${areaCode}
        )
        SELECT 
          s.longitude as lng,
          s.latitude as lat,
          s.store_name as name,
          s.road_name_address as address
        FROM seoul_commercial_store_info s, area_geom a
        WHERE s.business_category_small_code LIKE ${industryCode + '%'}
          AND ST_Intersects(s.geom, a.geom)
        LIMIT ${limit}
      `;
    } else if (level === 'dong') {
      // 행정동: admin_area_dong (polygons JSON)
      result = await this.prisma.$queryRaw<
        { lng: number; lat: number; name: string; address: string }[]
      >`
        WITH area_geom AS (
          SELECT ST_Transform(
            ST_SetSRID(
              ST_GeomFromGeoJSON(
                jsonb_build_object(
                  'type',
                  CASE 
                    WHEN jsonb_typeof(polygons #> '{0,0,0}') = 'number' THEN 'Polygon' 
                    ELSE 'MultiPolygon' 
                  END,
                  'coordinates',
                  polygons
                )
              ),
              5179
            ),
            4326
          ) as geom
          FROM admin_area_dong
          WHERE adstrd_cd = ${areaCode}
        )
        SELECT 
          s.longitude as lng,
          s.latitude as lat,
          s.store_name as name,
          s.road_name_address as address
        FROM seoul_commercial_store_info s, area_geom a
        WHERE s.business_category_small_code LIKE ${industryCode + '%'}
          AND ST_Intersects(s.geom, a.geom)
        LIMIT ${limit}
      `;
    }

    console.log(`[MarketRepository] Found ${result.length} stores.`);
    return result;
  }
}
