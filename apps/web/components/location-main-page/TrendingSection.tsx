'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  fetchStoreActivityRanking,
  StoreActivityRankItem,
} from '@/services/location/location.service';

export function TrendingSection() {
  const [data, setData] = useState<StoreActivityRankItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const result = await fetchStoreActivityRanking('growth');
        setData(result.slice(0, 10));
      } catch (error) {
        console.error('Failed to fetch trending locations:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  // 스크롤 관련 상태 및 ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // 스크롤 위치 체크
  const checkScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } =
        scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      // 여유분 1px를 둬서 부동소수점 오차 방지
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScroll);
      // 초기 체크
      checkScroll();
      window.addEventListener('resize', checkScroll);
      return () => {
        container.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [checkScroll, data]); // data가 바뀌면 다시 체크

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({
        left: -800, // 일관된 스크롤 크기 적용
        behavior: 'smooth',
      });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({
        left: 800,
        behavior: 'smooth',
      });
    }
  };

  return (
    <section className="px-8 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-h3 font-heading text-foreground">
          점포가 증가한 상권
        </h2>
        <Link
          href="/locations/search?tab=폐업률 높은 순"
          className="flex items-center gap-1 text-body font-strong text-muted-foreground hover:text-foreground transition-colors"
        >
          더보기 <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="relative group">
        {/* 왼쪽 화살표 */}
        <button
          onClick={scrollLeft}
          disabled={!canScrollLeft}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-background/80 backdrop-blur-sm border border-border shadow-md rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-background/80 disabled:hover:text-muted-foreground -ml-5"
          aria-label="이전 상권 목록"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>

        <div
          ref={scrollContainerRef}
          className="overflow-x-auto pt-2 pb-4 no-scrollbar scroll-smooth"
        >
          <div className="flex gap-4">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-72 shrink-0 rounded-2xl bg-background shadow-sm border border-border p-5 animate-pulse h-40"
                  >
                    <div className="h-5 w-16 rounded-full bg-muted mb-3" />
                    <div className="h-5 w-40 rounded bg-muted mb-2" />
                    <div className="h-4 w-24 rounded bg-muted" />
                  </div>
                ))
              : data.map((item, index) => (
                  <Link
                    key={item.code}
                    href={`/locations/detail/${item.code}`}
                    className="w-72 shrink-0 rounded-2xl bg-background shadow-sm border border-border p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                  >
                    <span className="inline-block px-3 py-1 rounded-full text-tiny font-heading text-primary-foreground bg-primary mb-2">
                      TOP {index + 1}
                    </span>
                    <h4 className="text-h5 font-heading text-foreground mb-1 line-clamp-1">
                      {item.name}
                    </h4>
                    <div className="flex justify-between items-end mt-4">
                      <div>
                        <span className="text-caption font-strong text-muted-foreground block">
                          현재 점포
                        </span>
                        <span className="text-h5 font-heading">
                          {item.currentStoreCount.toLocaleString()}개
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-caption font-strong text-muted-foreground block">
                          증가율
                        </span>
                        <span className="text-h5 font-heading text-primary">
                          {item.growthRate > 0 ? '+' : ''}
                          {item.growthRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
          </div>
        </div>

        {/* 오른쪽 화살표 */}
        <button
          onClick={scrollRight}
          disabled={!canScrollRight}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-background/80 backdrop-blur-sm border border-border shadow-md rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-background/80 disabled:hover:text-muted-foreground -mr-5"
          aria-label="다음 상권 목록"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      </div>
    </section>
  );
}
