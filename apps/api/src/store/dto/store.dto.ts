import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Prisma, PrismaClient } from '../../../generated/prisma/client';

export const storeLevels = [
  'city',
  'gu',
  'dong',
  'backarea',
  'commercial',
] as const;
export type StoreLevel = (typeof storeLevels)[number];

export class StoreStatsDto {
  industryCode: string;
  industryName: string;
  storeCount: number;
  similarStoreCount: number;
  franchiseStoreCount: number;
  openRate: number;
  openStoreCount: number;
  closeRate: number;
  closeStoreCount: number;
}

export class StoreResponseDto {
  level: StoreLevel;
  code: string;
  quarter: string;
  items: StoreStatsDto[];
}

export class GetStoreQueryDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(storeLevels)
  level: StoreLevel;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  industryCode?: string;

  @IsString()
  @IsOptional()
  quarter?: string;
}

/**
 * 업종별 점포 위치 조회 DTO
 * GET /store/locations?industryCode=I21006&minLng=126.9&maxLng=127.1&minLat=37.4&maxLat=37.6
 */
export class GetStoreLocationsQueryDto {
  @IsString()
  @IsOptional()
  industryCode?: string; // DB 업종 코드 (예: I21006 치킨), 없으면 전체 조회

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  minLng?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  maxLng?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  minLat?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  maxLat?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  // @Max(2000)
  limit?: number;

  @IsString()
  @IsOptional()
  areaCode?: string;

  @IsString()
  @IsOptional()
  // @IsIn(storeLevels)
  level?: StoreLevel;
}

export class StoreLocationDto {
  lng: number;
  lat: number;
  name: string;
  address: string;
}

export class StoreLocationsResponseDto {
  industryCode: string;
  count: number;
  stores: StoreLocationDto[];
}

// 폐업률 랭킹 DTOs
export class GetClosureRateRankingQueryDto {
  @IsString()
  @IsOptional()
  @IsIn(['gu', 'dong', 'commercial'])
  level?: 'gu' | 'dong' | 'commercial';

  @IsString()
  @IsOptional()
  industryCode?: string;

  @IsOptional()
  @IsString()
  keyword?: string; // 검색 키워드 추가
}

export class ClosureRateRankingItemDto {
  code: string;
  name: string;
  closureRate: number; // 폐업률 (%)
  closedStoreCount: number; // 폐업 점포 수
  currentStoreCount: number; // 현재 점포 수
  previousStoreCount: number; // 전분기 점포 수
  changeType?: string; // 상권 상태
}

export class ClosureRateRankingResponseDto {
  level: string;
  quarter: string;
  items: ClosureRateRankingItemDto[];
}

export class GetStoreActivityRankingQueryDto {
  @IsString()
  @IsOptional()
  @IsIn(['count', 'growth'])
  sortBy?: 'count' | 'growth';

  @IsString()
  @IsOptional()
  industryCode?: string;
}

export class StoreActivityRankingItemDto {
  code: string;
  name: string;
  currentStoreCount: number;
  previousStoreCount: number;
  growthRate: number;
}

export class StoreActivityRankingResponseDto {
  quarter: string;
  items: StoreActivityRankingItemDto[];
}

// ============================================
// 내부 서비스 타입 (Prisma 관련)
// ============================================

/**
 * Prisma Store 모델에서 조회되는 Row 타입
 * (storeCity, storeGu, storeDong, storeBackarea, storeCommercial 공통)
 */
export interface StoreStatsRow {
  stdr_yyqu_cd: string;
  svc_induty_cd: string;
  svc_induty_cd_nm: string;
  stor_co: number | bigint | null;
  similr_induty_stor_co: number | bigint | null;
  frc_stor_co: number | bigint | null;
  opbiz_rt: number | null;
  opbiz_stor_co: number | bigint | null;
  clsbiz_rt: number | null;
  clsbiz_stor_co: number | bigint | null;
}

/**
 * 최신 분기 조회 결과 타입
 */
export interface LatestQuarterRow {
  stdr_yyqu_cd: string;
}

/**
 * 폐업률 랭킹 Raw Query 결과 타입
 */
export interface ClosureRateRankingRawRow {
  code: string;
  name: string;
  currentStoreCount: bigint | number;
  previousStoreCount: bigint | number;
  closedStoreCount: bigint | number;
  closureRate: number;
}

export interface StoreActivityRankingRawRow {
  code: string;
  name: string;
  currentStoreCount: bigint | number;
  previousStoreCount: bigint | number;
  growthRate: number;
}

/**
 * Store 모델 Prisma Delegate 타입 (findMany, findFirst 메서드 포함)
 */
export type StorePrismaDelegate = {
  findMany: <T extends Prisma.Args<unknown, 'findMany'>>(
    args: T,
  ) => Promise<StoreStatsRow[]>;
  findFirst: <T extends Prisma.Args<unknown, 'findFirst'>>(
    args: T,
  ) => Promise<LatestQuarterRow | null>;
};

/**
 * Store 모델 이름 타입
 */
export type StoreModelName =
  | 'storeCity'
  | 'storeGu'
  | 'storeDong'
  | 'storeBackarea'
  | 'storeCommercial';

/**
 * 모델 설정 타입
 */
export interface ModelConfig {
  codeField: string;
  nameField: string;
  modelName: StoreModelName;
}

/**
 * Prisma 클라이언트에서 Store 모델 delegate를 타입 안전하게 가져오는 헬퍼 함수
 */
export function getStoreDelegate(
  prisma: PrismaClient,
  modelName: StoreModelName,
): StorePrismaDelegate {
  const delegates: Record<StoreModelName, StorePrismaDelegate> = {
    storeCity: prisma.storeCity as unknown as StorePrismaDelegate,
    storeGu: prisma.storeGu as unknown as StorePrismaDelegate,
    storeDong: prisma.storeDong as unknown as StorePrismaDelegate,
    storeBackarea: prisma.storeBackarea as unknown as StorePrismaDelegate,
    storeCommercial: prisma.storeCommercial as unknown as StorePrismaDelegate,
  };

  return delegates[modelName];
}
