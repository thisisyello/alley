import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarketRepository } from '../market/market.repository';
import { Prisma } from '../../generated/prisma/client';
import {
  GetStoreQueryDto,
  StoreLevel,
  StoreResponseDto,
  GetStoreLocationsQueryDto,
  StoreLocationsResponseDto,
  ModelConfig,
  StoreStatsRow,
  ClosureRateRankingRawRow,
  StoreActivityRankingRawRow,
  StorePrismaDelegate,
  getStoreDelegate,
} from './dto/store.dto';

@Injectable()
export class StoreService {
  private readonly logger = new Logger(StoreService.name);

  private readonly modelMap: Record<StoreLevel, ModelConfig> = {
    city: {
      codeField: 'mega_cd',
      nameField: 'mega_cd_nm',
      modelName: 'storeCity',
    },
    gu: {
      codeField: 'signgu_cd',
      nameField: 'signgu_cd_nm',
      modelName: 'storeGu',
    },
    dong: {
      codeField: 'adstrd_cd',
      nameField: 'adstrd_cd_nm',
      modelName: 'storeDong',
    },
    backarea: {
      codeField: 'trdar_cd',
      nameField: 'trdar_cd_nm',
      modelName: 'storeBackarea',
    },
    commercial: {
      codeField: 'trdar_cd',
      nameField: 'trdar_cd_nm',
      modelName: 'storeCommercial',
    },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketRepository: MarketRepository,
  ) {}

  async getStoreStats(query: GetStoreQueryDto): Promise<StoreResponseDto> {
    const { level, code, industryCode, quarter } = query;
    const modelConfig = this.modelMap[level];
    if (!modelConfig) {
      throw new BadRequestException(`지원하지 않는 레벨: ${level}`);
    }

    const client = getStoreDelegate(this.prisma, modelConfig.modelName);

    const resolvedQuarter = quarter || (await this.getLatestQuarter(client));

    const where: Record<string, string> = {
      stdr_yyqu_cd: resolvedQuarter,
      [modelConfig.codeField]: code,
    };
    if (industryCode) {
      where.svc_induty_cd = industryCode;
    }

    const rows = await client.findMany({
      where,
      select: {
        stdr_yyqu_cd: true,
        svc_induty_cd: true,
        svc_induty_cd_nm: true,
        stor_co: true,
        similr_induty_stor_co: true,
        frc_stor_co: true,
        opbiz_rt: true,
        opbiz_stor_co: true,
        clsbiz_rt: true,
        clsbiz_stor_co: true,
      },
    });

    return {
      level,
      code,
      quarter: resolvedQuarter,
      items: rows.map((row: StoreStatsRow) => ({
        industryCode: row.svc_induty_cd,
        industryName: row.svc_induty_cd_nm,
        storeCount: Number(row.stor_co || 0),
        similarStoreCount: Number(row.similr_induty_stor_co || 0),
        franchiseStoreCount: Number(row.frc_stor_co || 0),
        openRate: Number(row.opbiz_rt || 0),
        openStoreCount: Number(row.opbiz_stor_co || 0),
        closeRate: Number(row.clsbiz_rt || 0),
        closeStoreCount: Number(row.clsbiz_stor_co || 0),
      })),
    };
  }

  /**
   * 업종 코드로 점포 위치 조회
   * @param query 업종 코드 및 bbox 필터
   * @returns 점포 위치 목록
   */
  async getStoreLocations(
    query: GetStoreLocationsQueryDto,
  ): Promise<StoreLocationsResponseDto> {
    const {
      industryCode,
      minLng,
      maxLng,
      minLat,
      maxLat,
      limit,
      areaCode,
      level,
    } = query;

    let stores: { lng: number; lat: number; name: string; address: string }[] =
      [];

    // 1. 지역 코드가 있으면 Polygon 검색 우선
    if (areaCode && level) {
      stores = await this.marketRepository.findStoresByIndustryAndArea({
        industryCode: industryCode || '',
        areaCode,
        level,
        limit: limit || 1000,
      });
    } else {
      // 2. bbox가 있으면 사용
      const bbox =
        minLng !== undefined &&
        maxLng !== undefined &&
        minLat !== undefined &&
        maxLat !== undefined
          ? { minLng, maxLng, minLat, maxLat }
          : undefined;

      stores = await this.marketRepository.findStoresByIndustryCode({
        industryCode: industryCode || '',
        bbox,
        limit: limit || 100,
      });
    }

    return {
      industryCode: industryCode || 'ALL',
      count: stores.length,
      stores,
    };
  }

  /**
   * 폐업률 높은 순 랭킹
   * GET /store/ranking/closure?level=commercial&industryCode=CS100001
   */
  async getClosureRateRanking(
    level: 'commercial',
    industryCode?: string,
    keyword?: string, // 키워드 추가
  ): Promise<{
    level: string;
    quarter: string;
    items: {
      code: string;
      name: string;
      closureRate: number;
      closedStoreCount: number;
      currentStoreCount: number;
      previousStoreCount: number;
      changeType?: string;
    }[];
  }> {
    const modelConfig = this.modelMap['commercial'];
    const client = getStoreDelegate(this.prisma, modelConfig.modelName);
    const currentQ = await this.getLatestQuarter(client);
    const prevQ = this.getPreviousQuarter(currentQ);

    // Raw Query로 최적화
    // 폐업 점포 수 = MAX(0, 전분기 점포 수 - 현분기 점포 수)
    // 폐업률 = (폐업 점포 수 / 전분기 점포 수) * 100

    // 업종 필터 조건 (SQL Injection 방지를 위해 Prisma 파라미터 바인딩 사용)
    const industryCondition = industryCode
      ? `AND svc_induty_cd = '${industryCode}'`
      : '';

    // 검색 조건 추가
    const searchCondition = keyword
      ? `AND ${modelConfig.nameField} LIKE '%${keyword}%'`
      : '';
    // LIMIT 조건: 검색어가 있으면 제한 없음, 없으면 100개
    const limitCondition = keyword ? '' : 'LIMIT 100';

    // 상권 코드와 이름 컬럼명 (commercial 기준)
    const codeCol = 'trdar_cd';
    const nameCol = 'trdar_cd_nm';
    const table = 'store_commercial';

    const query = `
      WITH CurrentStats AS (
        SELECT 
          ${codeCol} as code, 
          MAX(${nameCol}) as name, 
          SUM(stor_co) as current_count
        FROM ${table}
        WHERE stdr_yyqu_cd = '${currentQ}' ${industryCondition} ${searchCondition}
        GROUP BY ${codeCol}
      ),
      PrevStats AS (
        SELECT 
          ${codeCol} as code, 
          SUM(stor_co) as prev_count
        FROM ${table}
        WHERE stdr_yyqu_cd = '${prevQ}' ${industryCondition}
        GROUP BY ${codeCol}
      )
      SELECT 
        c.code,
        c.name,
        c.current_count as "currentStoreCount",
        COALESCE(p.prev_count, 0) as "previousStoreCount",
        GREATEST(0, COALESCE(p.prev_count, 0) - c.current_count) as "closedStoreCount",
        CASE 
          WHEN COALESCE(p.prev_count, 0) > 0 
          THEN (GREATEST(0, COALESCE(p.prev_count, 0) - c.current_count)::float / p.prev_count::float) * 100 
          ELSE 0 
        END as "closureRate"
      FROM CurrentStats c
      LEFT JOIN PrevStats p ON c.code = p.code
      WHERE c.current_count > 0 
      ORDER BY "closureRate" DESC
      ${limitCondition};
    `;

    const results =
      await this.prisma.$queryRawUnsafe<ClosureRateRankingRawRow[]>(query);

    const items = results.map((row) => {
      const closureRate = Number(row.closureRate.toFixed(1));
      let changeType = '정체 상권';
      if (closureRate < 3) changeType = '안정 상권';
      else if (closureRate > 10) changeType = '위험 상권';

      return {
        code: row.code,
        name: row.name,
        closureRate,
        closedStoreCount: Number(row.closedStoreCount),
        currentStoreCount: Number(row.currentStoreCount),
        previousStoreCount: Number(row.previousStoreCount),
        changeType,
      };
    });

    return { level, quarter: currentQ, items };
  }

  async getStoreActivityRanking(
    sortBy: 'count' | 'growth',
    industryCode?: string,
  ) {
    const client = getStoreDelegate(this.prisma, 'storeCommercial');
    const currentQ = await this.getLatestQuarter(client);
    const prevQ = this.getPreviousQuarter(currentQ);
    const industryFilter = industryCode
      ? Prisma.sql`AND svc_induty_cd = ${industryCode}`
      : Prisma.empty;
    const orderBy =
      sortBy === 'growth'
        ? Prisma.sql`"growthRate" DESC, "currentStoreCount" DESC`
        : Prisma.sql`"currentStoreCount" DESC`;

    const rows = await this.prisma.$queryRaw<StoreActivityRankingRawRow[]>(
      Prisma.sql`
        WITH current_stats AS (
          SELECT
            trdar_cd AS code,
            MAX(trdar_cd_nm) AS name,
            SUM(stor_co) AS current_count
          FROM store_commercial
          WHERE stdr_yyqu_cd = ${currentQ} ${industryFilter}
          GROUP BY trdar_cd
        ),
        previous_stats AS (
          SELECT trdar_cd AS code, SUM(stor_co) AS previous_count
          FROM store_commercial
          WHERE stdr_yyqu_cd = ${prevQ} ${industryFilter}
          GROUP BY trdar_cd
        )
        SELECT
          current.code,
          current.name,
          current.current_count AS "currentStoreCount",
          COALESCE(previous.previous_count, 0) AS "previousStoreCount",
          CASE
            WHEN COALESCE(previous.previous_count, 0) > 0 THEN
              ((current.current_count - previous.previous_count)::float /
                previous.previous_count::float) * 100
            ELSE 0
          END AS "growthRate"
        FROM current_stats current
        LEFT JOIN previous_stats previous ON current.code = previous.code
        WHERE current.current_count > 0
        ORDER BY ${orderBy}
        LIMIT 20
      `,
    );

    return {
      quarter: currentQ,
      items: rows.map((row) => ({
        code: row.code,
        name: row.name,
        currentStoreCount: Number(row.currentStoreCount),
        previousStoreCount: Number(row.previousStoreCount),
        growthRate: Number(row.growthRate.toFixed(1)),
      })),
    };
  }

  private getPreviousQuarter(quarter: string): string {
    const year = parseInt(quarter.slice(0, 4), 10);
    const q = parseInt(quarter.slice(4), 10);
    if (q === 1) {
      return `${year - 1}4`;
    }
    return `${year}${q - 1}`;
  }

  private async getLatestQuarter(client: StorePrismaDelegate): Promise<string> {
    const latest = await client.findFirst({
      select: { stdr_yyqu_cd: true },
      orderBy: { stdr_yyqu_cd: 'desc' },
    });

    if (!latest?.stdr_yyqu_cd) {
      this.logger.warn('기준 분기 데이터가 없습니다.');
      throw new BadRequestException('점포 데이터가 없습니다.');
    }

    return latest.stdr_yyqu_cd;
  }
}
