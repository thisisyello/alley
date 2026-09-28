export type RevenueLevel = 'city' | 'gu' | 'dong' | 'backarea' | 'commercial';

export interface LocationRankItem {
  id: string;
  rank: number;
  code: string;
  name: string;
  storeCount: number;
  avgRevenue: string;
  growthRate: number;
  totalRevenue: string;
  ratio: { male: number; female: number };
  status: string;
  statusType: 'stable' | 'danger' | 'hot' | 'variable';
}

export interface AverageSalesRankingItem {
  code: string;
  name: string;
  industryCode?: string;
  industryName?: string;
  totalRevenue: number;
  avgSalesPerStore: number;
  storeCount: number;
  maleRatio: number;
  femaleRatio: number;
  changeType?: string;
  fluctuationRate?: number;
}

export interface AverageSalesRankingResponse {
  level: RevenueLevel;
  industryCode?: string;
  items: AverageSalesRankingItem[];
}

export interface StoreActivityRankItem {
  code: string;
  name: string;
  currentStoreCount: number;
  previousStoreCount: number;
  growthRate: number;
}

export const fetchStoreActivityRanking = async (
  sortBy: 'count' | 'growth',
): Promise<StoreActivityRankItem[]> => {
  const params = new URLSearchParams({ sortBy });
  const response = await fetch(
    `${API_URL}/store/ranking/activity?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error('Failed to fetch store activity ranking');
  }

  const data = (await response.json()) as {
    items: StoreActivityRankItem[];
  };
  return data.items;
};

// 대분류 업종
export interface IndustryCategory {
  code: string;
  name: string;
}

export interface IndustryMajorCategory {
  major: string;
  items: IndustryCategory[];
}

// 대분류/소분류 업종 목록
export const INDUSTRY_CATEGORIES: IndustryMajorCategory[] = [
  {
    major: '음식',
    items: [
      { code: 'CS100001', name: '한식음식점' },
      { code: 'CS100002', name: '중식음식점' },
      { code: 'CS100003', name: '일식음식점' },
      { code: 'CS100004', name: '양식음식점' },
      { code: 'CS100005', name: '제과점' },
      { code: 'CS100006', name: '패스트푸드점' },
      { code: 'CS100007', name: '치킨전문점' },
      { code: 'CS100008', name: '분식전문점' },
      { code: 'CS100009', name: '호프·간이주점' },
      { code: 'CS100010', name: '커피·음료' },
    ],
  },
  {
    major: '소매',
    items: [
      { code: 'CS300001', name: '슈퍼마켓' },
      { code: 'CS300002', name: '편의점' },
      { code: 'CS300003', name: '컴퓨터및주변장치' },
      { code: 'CS300004', name: '핸드폰' },
      { code: 'CS300006', name: '미곡판매' },
      { code: 'CS300007', name: '육류판매' },
      { code: 'CS300008', name: '수산물판매' },
      { code: 'CS300009', name: '청과상' },
      { code: 'CS300010', name: '반찬가게' },
      { code: 'CS300011', name: '일반의류' },
      { code: 'CS300014', name: '신발' },
      { code: 'CS300015', name: '가방' },
      { code: 'CS300016', name: '안경' },
      { code: 'CS300018', name: '의약품' },
      { code: 'CS300020', name: '서적' },
      { code: 'CS300021', name: '문구' },
      { code: 'CS300022', name: '화장품' },
      { code: 'CS300031', name: '가구' },
      { code: 'CS300032', name: '가전제품' },
      { code: 'CS300033', name: '철물점' },
    ],
  },
  {
    major: '생활서비스',
    items: [
      { code: 'CS200023', name: '통신기기수리' },
      { code: 'CS200024', name: '스포츠클럽' },
      { code: 'CS200025', name: '자동차수리' },
      { code: 'CS200026', name: '자동차미용' },
      { code: 'CS200028', name: '미용실' },
      { code: 'CS200029', name: '네일숍' },
      { code: 'CS200030', name: '피부관리실' },
      { code: 'CS200031', name: '세탁소' },
      { code: 'CS200033', name: '부동산중개업' },
    ],
  },
  {
    major: '교육',
    items: [
      { code: 'CS200001', name: '일반교습학원' },
      { code: 'CS200002', name: '외국어학원' },
      { code: 'CS200003', name: '예술학원' },
      { code: 'CS200005', name: '스포츠강습' },
    ],
  },
  {
    major: '의료',
    items: [
      { code: 'CS200006', name: '일반의원' },
      { code: 'CS200007', name: '치과의원' },
      { code: 'CS200008', name: '한의원' },
      { code: 'CS200009', name: '동물병원' },
    ],
  },
  {
    major: '오락/여가',
    items: [
      { code: 'CS200016', name: '당구장' },
      { code: 'CS200017', name: '골프연습장' },
      { code: 'CS200018', name: '볼링장' },
      { code: 'CS200019', name: 'PC방' },
      { code: 'CS200037', name: '노래방' },
    ],
  },
  {
    major: '숙박',
    items: [
      { code: 'CS200034', name: '모텔/여관' },
      { code: 'CS200035', name: '게스트하우스' },
      { code: 'CS200036', name: '고시원' },
    ],
  },
];

const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

// 금액 포맷팅 헬퍼
const formatRevenue = (amount: number): string => {
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}억원`;
  } else if (amount >= 10000) {
    return `${Math.floor(amount / 10000).toLocaleString()}만원`;
  }
  return `${amount.toLocaleString()}원`;
};

// 상권 변화 지수를 상태로 변환
const getStatusFromChangeType = (
  changeType?: string,
): { status: string; statusType: 'stable' | 'danger' | 'hot' | 'variable' } => {
  switch (changeType) {
    case 'HH':
    case 'HL':
      return { status: '뜨는 상권', statusType: 'hot' };
    case 'LL':
    case 'LH':
      return { status: '안정 상권', statusType: 'stable' };
    case '정체':
      return { status: '정체 상권', statusType: 'danger' };
    default:
      return { status: '변동 상권', statusType: 'variable' };
  }
};

export type SortBy = 'average' | 'growth';

export const fetchLocationRanking = async (
  level: RevenueLevel = 'commercial',
  industryCode?: string,
  sortBy: SortBy = 'average',
  keyword?: string, // 추가
): Promise<LocationRankItem[]> => {
  const params = new URLSearchParams({ level, sortBy });
  if (industryCode) {
    params.append('industryCode', industryCode);
  }
  if (keyword) {
    params.append('keyword', keyword);
  }

  const response = await fetch(
    `${API_URL}/revenue/ranking/average?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error('Failed to fetch location ranking');
  }

  const data: AverageSalesRankingResponse = await response.json();

  return data.items.map((item, index) => {
    const { status, statusType } = getStatusFromChangeType(item.changeType);

    return {
      id: item.code,
      rank: index + 1,
      code: item.code,
      name: item.name,
      storeCount: item.storeCount,
      avgRevenue: formatRevenue(item.avgSalesPerStore),
      growthRate: item.fluctuationRate || 0,
      totalRevenue: formatRevenue(item.totalRevenue),
      ratio: { male: item.maleRatio, female: item.femaleRatio },
      status,
      statusType,
    };
  });
};

// 유동인구 랭킹 관련 타입
export type AgeGroup = 'total' | '10' | '20' | '30' | '40' | '50' | '60';
export type TimeSlot = 'total' | '00' | '06' | '11' | '14' | '17' | '21';

export const AGE_GROUP_OPTIONS: { value: AgeGroup; label: string }[] = [
  { value: 'total', label: '전체 연령' },
  { value: '10', label: '10대' },
  { value: '20', label: '20대' },
  { value: '30', label: '30대' },
  { value: '40', label: '40대' },
  { value: '50', label: '50대' },
  { value: '60', label: '60대 이상' },
];

export const TIME_SLOT_OPTIONS: { value: TimeSlot; label: string }[] = [
  { value: 'total', label: '전체' },
  { value: '00', label: '새벽' },
  { value: '06', label: '오전' },
  { value: '11', label: '점심' },
  { value: '14', label: '오후' },
  { value: '17', label: '저녁' },
  { value: '21', label: '야간' },
];

export interface PopulationRankItem {
  id: string;
  rank: number;
  code: string;
  name: string;
  population: string;
  growthRate: number;
  status: string;
  statusType: 'stable' | 'danger' | 'hot' | 'variable';
}

interface PopulationRankingApiItem {
  code: string;
  name: string;
  amount: number;
  count: number;
  changeType?: string;
  fluctuationRate?: number;
}

// 유동인구 포맷팅
const formatPopulation = (amount: number): string => {
  if (amount >= 10000000) {
    return `약 ${(amount / 10000).toLocaleString()}만명`;
  } else if (amount >= 10000) {
    return `약 ${Math.floor(amount / 10000).toLocaleString()}만명`;
  }
  return `${amount.toLocaleString()}명`;
};

export const fetchPopulationRanking = async (
  level: 'gu' | 'dong' | 'commercial' = 'commercial',
  ageGroup: AgeGroup = 'total',
  timeSlot: TimeSlot = 'total',
  keyword?: string, // 추가
): Promise<PopulationRankItem[]> => {
  const params = new URLSearchParams({ level });
  if (ageGroup !== 'total') params.append('ageGroup', ageGroup);
  if (timeSlot !== 'total') params.append('timeSlot', timeSlot);
  if (keyword) params.append('keyword', keyword);

  const response = await fetch(
    `${API_URL}/floating-population/ranking?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error('Failed to fetch population ranking');
  }

  const data: { items: PopulationRankingApiItem[] } = await response.json();

  return data.items.map((item, index) => {
    const { status, statusType } = getStatusFromChangeType(item.changeType);

    return {
      id: item.code,
      rank: index + 1,
      code: item.code,
      name: item.name,
      population: formatPopulation(item.amount),
      growthRate: item.fluctuationRate || 0,
      status,
      statusType,
    };
  });
};

// 폐업률 랭킹 타입
export interface ClosureRateRankItem {
  id: string;
  rank: number;
  code: string;
  name: string;
  closureRate: number;
  closedStoreCount: number;
  currentStoreCount: number;
  previousStoreCount: number;
  status: string;
  statusType: 'stable' | 'danger' | 'hot' | 'variable';
}

interface ClosureRateRankingApiItem {
  code: string;
  name: string;
  closureRate: number;
  closedStoreCount: number;
  currentStoreCount: number;
  previousStoreCount: number;
  changeType?: string;
}

export const fetchClosureRateRanking = async (
  level: 'gu' | 'dong' | 'commercial' = 'commercial',
  industryCode?: string,
  keyword?: string, // 추가
): Promise<ClosureRateRankItem[]> => {
  const params = new URLSearchParams({ level });
  if (industryCode) params.append('industryCode', industryCode);
  if (keyword) params.append('keyword', keyword);

  const response = await fetch(
    `${API_URL}/store/ranking/closure?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error('Failed to fetch closure rate ranking');
  }

  const data: { items: ClosureRateRankingApiItem[] } = await response.json();

  return data.items.map((item, index) => {
    // 상태 결정
    let status = '정체 상권';
    let statusType: 'stable' | 'danger' | 'hot' | 'variable' = 'variable';

    if (item.closureRate < 3) {
      status = '안정 상권';
      statusType = 'stable';
    } else if (item.closureRate > 10) {
      status = '위험 상권';
      statusType = 'danger';
    }

    return {
      id: item.code,
      rank: index + 1,
      code: item.code,
      name: item.name,
      closureRate: item.closureRate,
      closedStoreCount: item.closedStoreCount,
      currentStoreCount: item.currentStoreCount,
      previousStoreCount: item.previousStoreCount,
      status,
      statusType,
    };
  });
};

export const fetchMZRanking = async (
  level: 'gu' | 'dong' | 'commercial' = 'commercial',
  keyword?: string,
): Promise<PopulationRankItem[]> => {
  const params = new URLSearchParams({ level });
  if (keyword) params.append('keyword', keyword);

  const response = await fetch(
    `${API_URL}/floating-population/ranking/mz?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error('Failed to fetch MZ ranking');
  }

  const data: { items: PopulationRankingApiItem[] } = await response.json();

  return data.items.map((item, index) => {
    const { status, statusType } = getStatusFromChangeType(item.changeType);

    return {
      id: item.code,
      rank: index + 1,
      code: item.code,
      name: item.name,
      population: formatPopulation(item.amount), // MZ 인구 수
      growthRate: item.fluctuationRate || 0, // 여기서는 비중(%)을 의미할 수 있음
      status,
      statusType,
    };
  });
};

export const fetchGenderRanking = async (
  level: 'gu' | 'dong' | 'commercial' = 'commercial',
  gender: 'male' | 'female' = 'female',
  keyword?: string,
): Promise<PopulationRankItem[]> => {
  const params = new URLSearchParams({ level, gender });
  if (keyword) params.append('keyword', keyword);

  const response = await fetch(
    `${API_URL}/floating-population/ranking/gender?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error('Failed to fetch gender ranking');
  }

  const data: { items: PopulationRankingApiItem[] } = await response.json();

  return data.items.map((item, index) => {
    const { status, statusType } = getStatusFromChangeType(item.changeType);

    return {
      id: item.code,
      rank: index + 1,
      code: item.code,
      name: item.name,
      population: formatPopulation(item.amount), // 성별 인구 수
      growthRate: item.fluctuationRate || 0, // 여기서는 비중(%)을 의미할 수 있음
      status,
      statusType,
    };
  });
};
