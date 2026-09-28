import { Controller, Get, Query } from '@nestjs/common';
import { StoreService } from './store.service';
import {
  GetStoreQueryDto,
  StoreResponseDto,
  GetStoreLocationsQueryDto,
  StoreLocationsResponseDto,
  GetClosureRateRankingQueryDto,
  ClosureRateRankingResponseDto,
  GetStoreActivityRankingQueryDto,
  StoreActivityRankingResponseDto,
} from './dto/store.dto';

@Controller('store')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get()
  getStoreStats(@Query() query: GetStoreQueryDto): Promise<StoreResponseDto> {
    return this.storeService.getStoreStats(query);
  }

  /**
   * 업종별 점포 위치 조회 API
   * GET /store/locations?industryCode=I21006&minLng=126.9&maxLng=127.1&minLat=37.4&maxLat=37.6
   */
  @Get('locations')
  getStoreLocations(
    @Query() query: GetStoreLocationsQueryDto,
  ): Promise<StoreLocationsResponseDto> {
    console.log('[StoreController] getStoreLocations query:', query);
    return this.storeService.getStoreLocations(query);
  }

  /**
   * 폐업률 낮은 순 랭킹 API
   * GET /store/ranking/closure?level=commercial&industryCode=CS100001
   */
  @Get('ranking/closure')
  getClosureRateRanking(
    @Query() query: GetClosureRateRankingQueryDto,
  ): Promise<ClosureRateRankingResponseDto> {
    return this.storeService.getClosureRateRanking(
      'commercial',
      query.industryCode,
      query.keyword, // 키워드 전달
    );
  }

  @Get('ranking/activity')
  getStoreActivityRanking(
    @Query() query: GetStoreActivityRankingQueryDto,
  ): Promise<StoreActivityRankingResponseDto> {
    return this.storeService.getStoreActivityRanking(
      query.sortBy ?? 'count',
      query.industryCode,
    );
  }
}
