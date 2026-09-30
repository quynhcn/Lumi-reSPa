'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Clock,
  Filter,
  Flower2,
  Gift,
  Heart,
  LayoutGrid,
  Leaf,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Smile,
  Sparkles,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SITE } from '@/lib/site-config';
import {
  formatDuration,
  formatPrice,
  categoryLabel,
  normalizeCategory,
  type Service,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { LeadDialog } from '@/components/landing/lead-form';
import { MobileActionBar } from '@/components/landing/contact-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const DURATION_FILTERS = [
  { label: 'Tất cả thời lượng', value: 'all' },
  { label: '< 60 phút', value: 'under_60' },
  { label: '60 – 90 phút', value: '60_90' },
  { label: '> 90 phút', value: 'over_90' },
];

const SORT_OPTIONS = [
  { label: 'Thứ tự mặc định', value: 'default' },
  { label: 'Giá: Thấp đến cao', value: 'price_asc' },
  { label: 'Giá: Cao đến thấp', value: 'price_desc' },
  { label: 'Thời lượng ngắn nhất', value: 'duration_asc' },
  { label: 'Thời lượng dài nhất', value: 'duration_desc' },
];

// Curated 6 Core Services matching Mockup Hình 1
const DEFAULT_SERVICES: Service[] = [
  {
    id: 'body-scrub',
    name: 'Body Scrub Tế Bào Chết',
    description: 'Tẩy tế bào chết toàn thân, làm sáng và mịn da, cho làn da khỏe mạnh, rạng rỡ.',
    duration_min: 45,
    price: 280000,
    category: 'Body Care',
    image_url: '/service-body.jpg',
    is_active: true,
    created_at: '2026-09-23T08:49:04.862763+00:00',
    updated_at: '2026-09-23T08:49:04.862763+00:00',
  },
  {
    id: 'headspa-relax',
    name: 'Gội Đầu Dưỡng Sinh',
    description: 'Gội đầu kết hợp massage da đầu và cổ, giúp giảm căng thẳng, thư giãn tinh thần.',
    duration_min: 30,
    price: 150000,
    category: 'Hair Care',
    image_url: '/service-headspa.jpg',
    is_active: true,
    created_at: '2026-09-23T08:49:04.862763+00:00',
    updated_at: '2026-09-23T08:49:04.862763+00:00',
  },
  {
    id: 'neck-shoulder',
    name: 'Massage Cổ Vai Gáy',
    description: 'Giảm đau mỏi cổ vai gáy, phù hợp người làm việc văn phòng, cải thiện tuần hoàn máu.',
    duration_min: 30,
    price: 180000,
    category: 'Massage',
    image_url: '/service-neck.jpg',
    is_active: true,
    created_at: '2026-09-23T08:49:04.862763+00:00',
    updated_at: '2026-09-23T08:49:04.862763+00:00',
  },
  {
    id: 'facial-deep',
    name: 'Chăm Sóc Da Mặt Chuyên Sâu',
    description: 'Làm sạch sâu, cấp ẩm và nuôi dưỡng làn da, cho da sáng khỏe, mịn màng.',
    duration_min: 60,
    price: 350000,
    category: 'Skincare',
    image_url: '/service-facial.jpg',
    is_active: true,
    created_at: '2026-09-23T08:49:04.862763+00:00',
    updated_at: '2026-09-23T08:49:04.862763+00:00',
  },
  {
    id: 'body-massage-hotstone',
    name: 'Massage Body Thư Giãn',
    description: 'Massage toàn thân với tinh dầu thiên nhiên, giúp thư giãn sâu, giảm căng thẳng.',
    duration_min: 60,
    price: 320000,
    category: 'Massage',
    image_url: '/about-hero-stone.jpg',
    is_active: true,
    created_at: '2026-09-23T08:49:04.862763+00:00',
    updated_at: '2026-09-23T08:49:04.862763+00:00',
  },
  {
    id: 'combo-all-inclusive',
    name: 'Combo Thư Giãn Toàn Diện',
    description: 'Kết hợp gội đầu dưỡng sinh, massage body và chăm sóc da mặt. Trải nghiệm trọn vẹn.',
    duration_min: 90,
    price: 550000,
    compare_at_price: 650000,
    category: 'Combo',
    image_url: '/service-special.jpg',
    includes: ['Gội đầu dưỡng sinh', 'Massage body tinh dầu', 'Chăm sóc da mặt chuyên sâu'],
    is_active: true,
    created_at: '2026-09-23T08:49:04.862763+00:00',
    updated_at: '2026-09-23T08:49:04.862763+00:00',
  },
];

const CATEGORY_TABS = [
  { id: 'all', label: 'Tất cả', icon: LayoutGrid },
  { id: 'Massage', label: 'Massage', icon: Sparkles },
  { id: 'Skincare', label: 'Chăm sóc da', icon: Smile },
  { id: 'Hair Care', label: 'Gội đầu dưỡng sinh', icon: Leaf },
  { id: 'Body Care', label: 'Chăm sóc cơ thể', icon: Flower2 },
  { id: 'combo', label: 'Combo ưu đãi', icon: Gift },
];

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>(DEFAULT_SERVICES);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDuration, setSelectedDuration] = useState<string>('all');
  const [selectedSort, setSelectedSort] = useState<string>('default');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('services')
          .select('*')
          .eq('is_active', true)
          .order('category')
          .order('price');

        if (error || !data) {
          setServices([]);
        } else {
          // Fallback image if missing
          const enriched = data.map((svc) => ({
            ...svc,
            image_url: svc.image_url || '/service-special.jpg',
          }));
          setServices(enriched);
        }
      } catch {
        setServices([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filter & Sort Logic
  const filteredServices = useMemo(() => {
    return services
      .filter((svc) => {
        const isCombo = (svc.includes?.length ?? 0) > 0 || normalizeCategory(svc.category) === 'Combo';

        // Search
        if (search.trim()) {
          const q = search.toLowerCase().trim();
          const matchName = svc.name.toLowerCase().includes(q);
          const matchDesc = (svc.description || '').toLowerCase().includes(q);
          const matchCat = categoryLabel(svc.category).toLowerCase().includes(q);
          if (!matchName && !matchDesc && !matchCat) return false;
        }

        // Category filter
        if (selectedCategory !== 'all') {
          if (selectedCategory === 'combo') {
            if (!isCombo) return false;
          } else {
            if (isCombo) return false;
            if (normalizeCategory(svc.category) !== selectedCategory) return false;
          }
        }

        // Duration filter
        if (selectedDuration === 'under_60' && svc.duration_min >= 60) return false;
        if (
          selectedDuration === '60_90' &&
          (svc.duration_min < 60 || svc.duration_min > 90)
        )
          return false;
        if (selectedDuration === 'over_90' && svc.duration_min <= 90) return false;

        return true;
      })
      .sort((a, b) => {
        if (selectedSort === 'price_asc') return a.price - b.price;
        if (selectedSort === 'price_desc') return b.price - a.price;
        if (selectedSort === 'duration_asc') return a.duration_min - b.duration_min;
        if (selectedSort === 'duration_desc') return b.duration_min - a.duration_min;
        return 0; // default order
      });
  }, [services, search, selectedCategory, selectedDuration, selectedSort]);

  const hasActiveFilters =
    search.trim() !== '' ||
    selectedCategory !== 'all' ||
    selectedDuration !== 'all' ||
    selectedSort !== 'default';

  const resetFilters = () => {
    setSearch('');
    setSelectedCategory('all');
    setSelectedDuration('all');
    setSelectedSort('default');
  };

  // Helper for category counts
  const getCategoryCount = (tabId: string) => {
    if (tabId === 'all') return services.length;
    if (tabId === 'combo') {
      return services.filter(
        (s) => (s.includes?.length ?? 0) > 0 || normalizeCategory(s.category) === 'Combo'
      ).length;
    }
    return services.filter(
      (s) =>
        normalizeCategory(s.category) === tabId &&
        !(s.includes?.length ?? 0 > 0) &&
        normalizeCategory(s.category) !== 'Combo'
    ).length;
  };

  // Format category badge display text
  const getBadgeLabel = (service: Service) => {
    if ((service.includes?.length ?? 0) > 0 || normalizeCategory(service.category) === 'Combo') {
      return 'Combo ưu đãi';
    }
    const cat = normalizeCategory(service.category);
    if (cat === 'Hair Care') return 'Gội đầu dưỡng sinh';
    if (cat === 'Body Care') return 'Chăm sóc cơ thể';
    if (cat === 'Skincare') return 'Chăm sóc da';
    if (cat === 'Massage') return 'Massage';
    return categoryLabel(service.category);
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] pb-16 sm:pb-0">
      <SiteHeader />

      {/* Hero Header (Matching Mockup Hình 1) */}
      <section className="relative overflow-hidden border-b border-[#EFE5D8] bg-[#FAF6F0] py-10 sm:py-12 lg:py-14">
        {/* Left Botanical Flourish */}
        <div className="pointer-events-none absolute -left-6 top-1/2 -translate-y-1/2 opacity-35 hidden md:block">
          <svg width="200" height="360" viewBox="0 0 200 360" fill="none" stroke="#CBB49C" strokeWidth="1.2">
            <circle cx="70" cy="90" r="7" fill="#E8D7C5" stroke="none" />
            <path d="M-20 240 C50 220 100 150 70 90 C50 50 10 20 -20 10" />
            <path d="M70 90 C110 75 150 110 135 150 C120 185 80 170 70 145" />
            <path d="M35 185 C75 185 90 225 65 250 C40 275 15 250 25 220" />
            <path d="M70 90 Q 95 65 105 85 Q 85 105 70 90 Z" fill="#F4EBE0" fillOpacity="0.4" />
            <path d="M50 130 Q 70 105 85 120 Q 70 145 50 130 Z" fill="#F4EBE0" fillOpacity="0.4" />
            <path d="M40 190 Q 65 170 75 190 Q 55 210 40 190 Z" fill="#F4EBE0" fillOpacity="0.4" />
          </svg>
        </div>

        <div className="relative mx-auto max-w-[1240px] px-6">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
            {/* Left Content Column */}
            <div className="lg:col-span-7">
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.22em] text-[#9B3E1F]">
                DỊCH VỤ &amp; LIỆU TRÌNH · {SITE.name}
              </span>
              <h1 className="mt-3 font-serif text-3xl sm:text-4xl lg:text-[46px] font-normal leading-[1.65] text-[#20140D]">
                <span className="font-bold">Chọn liệu trình</span>{' '}
                <span className="italic text-[#8D381B]">thích hợp</span>
                <br />
                <span className="italic text-[#8D381B]">cho bạn.</span>
              </h1>
              <p className="mt-3 max-w-xl text-xs sm:text-[13.5px] leading-relaxed text-[#6B5E55]">
                Toàn bộ danh mục chăm sóc cơ thể, massage trị liệu và gội đầu dưỡng sinh. Giá niêm yết rõ ràng, không phát sinh chi phí ẩn.
              </p>

              {/* Search Bar matching mockup */}
              <div className="mt-6 flex max-w-md items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8988B]" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm theo tên dịch vụ hoặc liệu trình..."
                    className="h-11 rounded-full pl-11 pr-10 text-xs sm:text-sm bg-white border-[#EBE0D2] shadow-sm text-[#20140D] placeholder:text-[#A8988B] focus-visible:ring-1 focus-visible:ring-[#8D381B]"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      aria-label="Xóa tìm kiếm"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#A8988B] hover:text-[#20140D]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetFilters}
                    className="h-11 gap-1.5 rounded-full border-[#EBE0D2] px-4 text-xs font-semibold text-[#6B5E55] hover:text-[#20140D] bg-white shadow-sm"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Đặt lại
                  </Button>
                )}
              </div>
            </div>

            {/* Right Banner Image Column matching mockup */}
            <div className="relative hidden lg:col-span-5 lg:block">
              <div className="relative overflow-hidden rounded-[26px] border border-[#EFE4D6] shadow-[0_12px_32px_rgba(40,20,10,0.06)] bg-[#FAF5EE]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/services-hero-banner.jpg"
                  alt="Lumière Spa Dịch vụ & Liệu trình"
                  className="h-auto w-full object-cover transition-transform duration-700 hover:scale-[1.02]"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content & Filters */}
      <section className="mx-auto max-w-[1240px] px-6 py-8 lg:py-10">
        {/* Category Pills matching Mockup Hình 1 */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 pb-6 border-b border-[#EFE5D8]">
          {CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon;
            const count = getCategoryCount(tab.id);
            const isActive = selectedCategory === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs sm:text-[13px] font-medium transition-all',
                  isActive
                    ? 'bg-[#8D381B] text-white shadow-sm'
                    : 'bg-[#FAF5EE] text-[#554238] border border-[#EBE0D2] hover:bg-[#F3ECE1] hover:text-[#20140D]'
                )}
              >
                <Icon className={cn('h-3.5 w-3.5', isActive ? 'text-white' : 'text-[#8D381B]')} />
                <span>
                  {tab.label} ({count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Sub-Filters: Duration & Sorting */}
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#554238]">
            <span className="flex items-center gap-1.5 font-semibold text-[#20140D] mr-1">
              <Clock className="h-3.5 w-3.5 text-[#8D381B]" /> Thời lượng:
            </span>
            {DURATION_FILTERS.map((df) => (
              <button
                key={df.value}
                type="button"
                onClick={() => setSelectedDuration(df.value)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs transition-colors',
                  selectedDuration === df.value
                    ? 'bg-[#20140D] text-white font-semibold shadow-sm'
                    : 'bg-white border border-[#E8DACB] text-[#554238] hover:bg-[#FAF4EC]'
                )}
              >
                {df.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs text-[#6B5E55]">
            <span>Sắp xếp:</span>
            <select
              value={selectedSort}
              onChange={(e) => setSelectedSort(e.target.value)}
              className="h-8 rounded-lg border border-[#E8DACB] bg-white px-2.5 text-xs text-[#20140D] focus:outline-none focus:ring-1 focus:ring-[#8D381B]"
            >
              {SORT_OPTIONS.map((so) => (
                <option key={so.value} value={so.value}>
                  {so.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="mt-5 flex items-center justify-between text-xs text-[#706359]">
          <span>
            Hiển thị <strong>{filteredServices.length}</strong> / {services.length} dịch vụ
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="font-semibold text-[#8D381B] hover:underline"
            >
              Xóa các bộ lọc đang chọn
            </button>
          )}
        </div>

        {/* Services Grid (6 Cards Matching Mockup Hình 1) */}
        {loading ? (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-80 rounded-[22px] bg-[#EFE5D8]/50 animate-pulse" />
            ))}
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="my-16 rounded-[24px] border border-dashed border-[#E8DACB] bg-white p-12 text-center shadow-sm">
            <Filter className="mx-auto h-10 w-10 text-[#CBB49C] mb-3" />
            <h3 className="font-serif text-2xl font-medium text-[#20140D]">Không tìm thấy dịch vụ phù hợp</h3>
            <p className="mt-2 text-xs sm:text-sm text-[#706359] max-w-md mx-auto">
              Không có dịch vụ nào khớp với bộ lọc hoặc từ khóa bạn vừa nhập. Vui lòng thử lại với tiêu chí khác.
            </p>
            <Button
              onClick={resetFilters}
              variant="outline"
              className="mt-6 rounded-xl border-[#E8DACB] text-xs font-semibold text-[#8D381B] hover:bg-[#FAF4EC]"
            >
              <RotateCcw className="mr-2 h-3.5 w-3.5" /> Đặt lại bộ lọc
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredServices.map((service) => {
              const isCombo = (service.includes?.length ?? 0) > 0 || normalizeCategory(service.category) === 'Combo';
              const isFav = favorites.has(service.id);

              return (
                <div
                  key={service.id}
                  className="group flex flex-col rounded-[22px] sm:rounded-[24px] bg-white border border-[#EFE5D8] overflow-hidden shadow-[0_4px_20px_rgba(40,20,10,0.03)] hover:shadow-[0_14px_36px_rgba(40,20,10,0.08)] hover:-translate-y-1 transition-all duration-300"
                >
                  {/* Service Image Banner with Category Badge & Heart Button */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#F5ECE1]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={service.image_url || '/service-special.jpg'}
                      alt={service.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-70" />

                    {/* Category Tag top-left */}
                    <span className="absolute top-3 left-3 rounded-full bg-black/55 backdrop-blur-md px-3 py-1 text-[11px] font-medium text-white flex items-center gap-1.5 shadow-sm">
                      {getBadgeLabel(service)}
                    </span>

                    {/* Wishlist Heart Button top-right */}
                    <button
                      type="button"
                      onClick={(e) => toggleFavorite(service.id, e)}
                      aria-label="Thêm vào yêu thích"
                      className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-md text-white transition-all hover:bg-black/60 hover:scale-105 shadow-sm"
                    >
                      <Heart
                        className={cn(
                          'h-4 w-4 transition-colors',
                          isFav ? 'fill-red-500 text-red-500' : 'text-white'
                        )}
                      />
                    </button>
                  </div>

                  {/* Service Info Content */}
                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    <h2 className="font-sans text-[17px] sm:text-[18px] font-bold leading-snug text-[#20140D] group-hover:text-[#8D381B] transition-colors">
                      {service.name}
                    </h2>
                    <p className="mt-2 text-xs sm:text-[13px] leading-relaxed text-[#6B5E55] line-clamp-2">
                      {service.description}
                    </p>

                    {isCombo && service.includes && service.includes.length > 0 && (
                      <div className="mt-3 rounded-xl bg-[#FAF5EE] p-2.5 border border-[#EFE5D8]">
                        <p className="text-[11px] font-semibold text-[#8D381B] mb-1">Gói trải nghiệm:</p>
                        <ul className="space-y-0.5 text-[11px] text-[#6B5E55]">
                          {service.includes.map((it) => (
                            <li key={it} className="flex items-center gap-1.5">
                              <Check className="h-3 w-3 shrink-0 text-[#8D381B]" /> {it}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Card Footer: Duration, Price, and Booking Button */}
                    <div className="mt-auto pt-4 flex items-end justify-between gap-3 border-t border-[#F2EAE0]">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs text-[#706359] font-medium">
                          <Clock className="h-3.5 w-3.5 text-[#8D381B]" />
                          <span>{formatDuration(service.duration_min)}</span>
                        </div>
                        <div className="mt-1">
                          <strong className="font-sans text-[17px] sm:text-[18px] font-bold text-[#20140D]">
                            {formatPrice(service.price)}
                          </strong>
                        </div>
                      </div>

                      <Link
                        href={`/booking?service=${service.id}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#8D381B] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#732912] transition-colors"
                      >
                        <span>Đặt lịch</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Consultation Callout */}
        <div className="mt-16 rounded-[26px] bg-[#FAF5EE] p-8 sm:p-10 border border-[#EFE5D8] text-center shadow-sm">
          <Sparkles className="mx-auto h-8 w-8 text-[#C49A62] mb-3" />
          <h3 className="font-serif text-2xl sm:text-3xl font-medium text-[#20140D]">
            Bạn chưa biết liệu trình nào phù hợp?
          </h3>
          <p className="mt-2 text-xs sm:text-sm text-[#706359] max-w-lg mx-auto leading-relaxed">
            Hãy để lại thông tin, chuyên viên tư vấn của Lumière Spa sẽ liên hệ giải đáp tình trạng da và cơ thể để gợi ý liệu trình tối ưu nhất.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <LeadDialog source="services_catalog" interest="Tư vấn chọn liệu trình">
              <Button size="lg" className="rounded-xl px-6 font-semibold bg-[#8D381B] hover:bg-[#732912] text-white">
                Yêu cầu gọi lại tư vấn
              </Button>
            </LeadDialog>
            <Link
              href="/booking"
              className="inline-flex items-center justify-center h-11 px-6 rounded-xl font-semibold border border-[#E8DACB] bg-white text-[#20140D] hover:bg-[#FAF4EC] transition-colors text-sm"
            >
              Đặt lịch online ngay
            </Link>
          </div>
        </div>
      </section>

      {/* Synchronized Site Footer */}
      <SiteFooter />

      <MobileActionBar />
    </div>
  );
}
