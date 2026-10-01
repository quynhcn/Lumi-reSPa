'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Clock, Flower2, Layers, Leaf, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

import { type Service, formatPrice } from '@/lib/types';

export interface ServiceItem {
  id: string;
  name: string;
  badge?: string;
  description: string;
  checklist: string[];
  duration: string;
  price: string;
  image: string;
  bookingUrl: string;
  detailUrl: string;
  iconType: 'lotus' | 'zen' | 'leaf' | 'sparkle';
}

const DEFAULT_SERVICES: ServiceItem[] = [
  {
    id: 'headspa',
    name: 'Gội đầu dưỡng sinh',
    description: 'Thư giãn tâm trí, loại bỏ căng thẳng, nuôi dưỡng tóc chắc khỏe.',
    checklist: ['Làm sạch sâu da đầu', 'Thư giãn, giảm stress', 'Kích thích tuần hoàn máu'],
    duration: '45 – 60 phút',
    price: '180.000 đ',
    image: '/service-headspa.jpg',
    bookingUrl: '/booking',
    detailUrl: '/services',
    iconType: 'lotus',
  },
  {
    id: 'neck',
    name: 'Massage cổ vai gáy',
    description: 'Giảm đau mỏi, thư giãn cơ bắp, phù hợp người làm việc văn phòng.',
    checklist: ['Giảm đau mỏi hiệu quả', 'Thư giãn cơ chuyên sâu', 'Cải thiện tuần hoàn máu'],
    duration: '30 – 60 phút',
    price: '180.000 đ',
    image: '/service-neck.jpg',
    bookingUrl: '/booking',
    detailUrl: '/services',
    iconType: 'zen',
  },
  {
    id: 'special',
    name: 'Liệu trình đặc biệt',
    badge: '★ ĐƯỢC YÊU THÍCH',
    description: 'Trải nghiệm chăm sóc toàn diện dành riêng cho bạn.',
    checklist: ['Kết hợp nhiều liệu pháp', 'Tùy chỉnh theo nhu cầu', 'Hiệu quả thư giãn sâu'],
    duration: '90 – 120 phút',
    price: '350.000 đ',
    image: '/service-special.jpg',
    bookingUrl: '/booking',
    detailUrl: '/services',
    iconType: 'lotus',
  },
  {
    id: 'body',
    name: 'Chăm sóc cơ thể',
    description: 'Tẩy tế bào chết, nuôi dưỡng làn da mịn màng và khỏe mạnh.',
    checklist: ['Tẩy tế bào chết toàn thân', 'Dưỡng ẩm chuyên sâu', 'Giúp da sáng mịn, đều màu'],
    duration: '60 – 90 phút',
    price: '280.000 đ',
    image: '/service-body.jpg',
    bookingUrl: '/booking',
    detailUrl: '/services',
    iconType: 'leaf',
  },
  {
    id: 'facial',
    name: 'Chăm sóc da mặt',
    description: 'Làn da rạng rỡ, khỏe mạnh với liệu trình phù hợp từng loại da.',
    checklist: ['Làm sạch sâu', 'Dưỡng ẩm & phục hồi', 'Cải thiện độ đàn hồi'],
    duration: '60 – 75 phút',
    price: '250.000 đ',
    image: '/service-facial.jpg',
    bookingUrl: '/booking',
    detailUrl: '/services',
    iconType: 'sparkle',
  },
];

export function ServiceShowcase({ services }: { services?: Service[] }) {
  const [activeIdx, setActiveIdx] = useState(2);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // Map real DB services to the UI format if provided
  const showcaseItems: ServiceItem[] = services && services.length >= 5 
    ? services.slice(0, 5).map((s, i) => ({
        id: s.id,
        name: s.name,
        badge: i === 2 ? '★ ĐƯỢC YÊU THÍCH' : undefined,
        description: s.description || DEFAULT_SERVICES[i]?.description || '',
        checklist: DEFAULT_SERVICES[i]?.checklist || ['Liệu trình chuyên sâu', 'Thư giãn hoàn toàn', 'Dịch vụ cao cấp'],
        duration: `${s.duration_min} phút`,
        price: formatPrice(s.price),
        image: s.image_url || DEFAULT_SERVICES[i]?.image || '/service-special.jpg',
        bookingUrl: `/booking?service=${s.id}`,
        detailUrl: '/services',
        iconType: DEFAULT_SERVICES[i]?.iconType || 'lotus',
      }))
    : [];

  const total = showcaseItems.length;

  if (total === 0) return null;

  const handlePrev = () => {
    setActiveIdx((prev) => (prev - 1 + total) % total);
  };

  const handleNext = () => {
    setActiveIdx((prev) => (prev + 1) % total);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX;
    if (diff > 40) handlePrev();
    if (diff < -40) handleNext();
    setTouchStartX(null);
  };

  const slots = [-2, -1, 0, 1, 2].map((offset) => {
    const itemIndex = (activeIdx + offset + total) % total;
    return {
      offset,
      itemIndex,
      item: showcaseItems[itemIndex],
    };
  });

  return (
    <section
      id="dich-vu"
      className="relative scroll-mt-20 overflow-hidden bg-[#FAF6F0] py-20 lg:py-28 select-none"
    >
      {/* Top Left: Sunlit Palm Frond Shadow */}
      <div className="pointer-events-none absolute -left-12 -top-12 h-96 w-96 opacity-15">
        <svg viewBox="0 0 200 200" fill="#3A2C21" className="h-full w-full blur-[1px]">
          <path d="M0,0 C40,70 90,120 180,140 C140,110 110,80 80,40 C60,20 30,10 0,0 Z" />
          <path d="M20,0 C60,60 110,100 190,110 C150,90 120,60 90,30 Z" />
          <path d="M0,30 C50,80 90,140 160,180 C120,140 90,100 60,60 Z" />
        </svg>
      </div>

      {/* Top Right: Golden Filigree Curves */}
      <div className="pointer-events-none absolute top-4 right-4 h-56 w-56 opacity-20 text-[#A27854] hidden lg:block">
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.8">
          <circle cx="90" cy="10" r="70" strokeDasharray="3 3" />
          <path d="M30,10 C50,30 70,60 95,95" />
          <path d="M45,10 C65,30 80,55 95,80" />
        </svg>
      </div>

      <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        {/* Section Header matching mockup */}
        <div className="text-center max-w-2xl mx-auto">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-3 justify-center">
            <span className="h-[1px] w-8 sm:w-14 bg-[#8D381B]/40" />
            <Flower2 className="h-4 w-4 text-[#8D381B]" />
            <span className="text-xs sm:text-[13px] font-bold tracking-[0.25em] text-[#8D381B] uppercase">
              LUMIÈRE SPA
            </span>
            <span className="h-[1px] w-8 sm:w-14 bg-[#8D381B]/40" />
          </div>

          {/* Heading with "phù hợp" in terracotta */}
          <h2 className="mt-3 font-serif text-3xl sm:text-4xl lg:text-[48px] font-medium leading-[1.65] tracking-normal text-[#1F1A17]">
            Chọn dịch vụ <span className="font-semibold text-[#8D381B]">phù hợp</span> cho bạn
          </h2>

          {/* Subtitle */}
          <p className="mt-3.5 text-[15px] sm:text-[16px] leading-[1.75] text-[#6B5F54]">
            Mỗi liệu trình tại Lumière Spa được thiết kế để nuôi dưỡng vẻ đẹp tự nhiên, giúp bạn cân bằng thân – tâm – trí.
          </p>
        </div>

        {/* 5-Card Circular Carousel Stage */}
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="relative mt-12 sm:mt-16 w-full flex items-center justify-center min-h-[620px] sm:min-h-[660px]"
        >
          {/* Navigation Button: Prev (<) */}
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Dịch vụ trước"
            className="absolute left-1 sm:left-3 xl:left-4 top-1/2 -translate-y-1/2 z-40 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/95 text-[#1F1A17] shadow-[0_8px_25px_rgba(40,25,15,0.18)] ring-1 ring-black/5 transition-all hover:bg-white hover:scale-110 active:scale-95 cursor-pointer"
          >
            <ChevronLeft className="h-6 w-6 stroke-[2.2]" />
          </button>

          {/* Navigation Button: Next (>) */}
          <button
            type="button"
            onClick={handleNext}
            aria-label="Dịch vụ tiếp theo"
            className="absolute right-1 sm:right-3 xl:right-4 top-1/2 -translate-y-1/2 z-40 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/95 text-[#1F1A17] shadow-[0_8px_25px_rgba(40,25,15,0.18)] ring-1 ring-black/5 transition-all hover:bg-white hover:scale-110 active:scale-95 cursor-pointer"
          >
            <ChevronRight className="h-6 w-6 stroke-[2.2]" />
          </button>

          {/* 5 Cards Row Container */}
          <div className="w-full flex items-center justify-center gap-3 sm:gap-4 xl:gap-5">
            {slots.map(({ offset, itemIndex, item }) => {
              const isCenter = offset === 0;
              const isFlanking = Math.abs(offset) === 1;
              const isOuter = Math.abs(offset) === 2;

              return (
                <div
                  key={`${item.id}-${offset}`}
                  onClick={() => setActiveIdx(itemIndex)}
                  className={cn(
                    'relative rounded-[28px] overflow-hidden flex flex-col cursor-pointer transition-all duration-500 ease-out select-none border border-[#EDE4D8]',
                    // Responsive visibility: Center always, flanking on sm+, outer on lg+
                    isOuter ? 'hidden lg:flex' : isFlanking ? 'hidden sm:flex' : 'flex',
                    // Hierarchy & styling
                    isCenter
                      ? 'w-[305px] sm:w-[315px] xl:w-[325px] min-h-[620px] sm:min-h-[650px] z-30 bg-white ring-2 ring-[#8D381B]/25 shadow-[0_30px_70px_rgba(40,25,15,0.2)] -translate-y-2 sm:-translate-y-4'
                      : isFlanking
                        ? 'w-[250px] sm:w-[260px] xl:w-[272px] min-h-[570px] sm:min-h-[595px] z-20 bg-white shadow-[0_14px_35px_rgba(40,25,15,0.08)] opacity-95 hover:opacity-100'
                        : 'w-[220px] sm:w-[235px] xl:w-[248px] min-h-[540px] sm:min-h-[565px] z-10 bg-white shadow-[0_8px_25px_rgba(40,25,15,0.05)] opacity-85 hover:opacity-100'
                  )}
                >
                  {/* Card Top: Photo */}
                  <div
                    className={cn(
                      'relative w-full overflow-hidden shrink-0 transition-all',
                      isCenter ? 'h-[235px] sm:h-[250px]' : isFlanking ? 'h-[210px] sm:h-[225px]' : 'h-[195px] sm:h-[210px]'
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                    />

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                    {/* Featured Badge for Center card */}
                    {isCenter && item.badge && (
                      <div className="absolute top-3.5 right-3.5 z-10">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#8D381B]/95 px-3 py-1 text-[11px] font-bold text-white shadow-md backdrop-blur-md">
                          {item.badge}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Floating Circular Icon Badge Overlapping photo bottom border */}
                  <div className="relative px-5 pt-0">
                    <div className="-mt-6 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-[#F5ECE2] text-[#8D381B] ring-4 ring-white shadow-md z-10">
                      {item.iconType === 'lotus' ? (
                        <Flower2 className="h-5 w-5 sm:h-6 sm:w-6" />
                      ) : item.iconType === 'zen' ? (
                        <Layers className="h-5 w-5 sm:h-6 sm:w-6" />
                      ) : item.iconType === 'leaf' ? (
                        <Leaf className="h-5 w-5 sm:h-6 sm:w-6" />
                      ) : (
                        <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />
                      )}
                    </div>
                  </div>

                  {/* Card Body: Rich Information that was previously empty */}
                  <div className="flex-1 p-5 pt-3 flex flex-col justify-between">
                    <div>
                      {/* Service Title */}
                      <h3
                        className={cn(
                          'font-serif font-bold text-[#1F1A17] leading-tight',
                          isCenter ? 'text-xl sm:text-[22px]' : 'text-lg sm:text-[19px]'
                        )}
                      >
                        {item.name}
                      </h3>

                      {/* Brief Summary */}
                      <p className="mt-2 text-xs sm:text-[13px] leading-relaxed text-[#6B5F54] line-clamp-2">
                        {item.description}
                      </p>

                      {/* 3 Checklist Items with warm checkmark icons */}
                      <ul className="mt-4 space-y-2 border-t border-[#F2ECE4] pt-3 text-xs sm:text-[12.5px] text-[#4A4036]">
                        {item.checklist.map((point, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#F5ECE2] text-[#8D381B]">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </span>
                            <span className="truncate">{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Bottom Section: Duration, Price & Action Button */}
                    <div className="mt-5 border-t border-[#F2ECE4] pt-3">
                      {/* Meta Row: Duration on Left, Price on Right */}
                      <div className="flex items-center justify-between text-xs sm:text-[13px] mb-3">
                        <span className="inline-flex items-center gap-1.5 text-[#7A6E65]">
                          <Clock className="h-3.5 w-3.5 text-[#8D381B]" />
                          <span>{item.duration}</span>
                        </span>
                        <strong className="font-bold text-[#8D381B] text-sm sm:text-base">
                          {item.price}
                        </strong>
                      </div>

                      {/* Action Button */}
                      {isCenter ? (
                        <Link
                          href={item.bookingUrl}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#8D381B] py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#762E15] hover:shadow-lg active:scale-95"
                        >
                          <span>Đặt lịch ngay</span>
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveIdx(itemIndex);
                          }}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[#D9CDC0] bg-[#FAF7F2] py-2.5 text-xs sm:text-sm font-medium text-[#782E15] transition-all hover:bg-white hover:border-[#8D381B] active:scale-95 cursor-pointer"
                        >
                          <span>Xem chi tiết</span>
                          <span className="text-xs">→</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 5-Dash Progress Indicators matching mockup */}
        <div className="mt-8 flex items-center justify-center gap-2">
          {showcaseItems.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveIdx(idx)}
              aria-label={`Đi tới ${s.name}`}
              className="group py-1 cursor-pointer"
            >
              <div
                className={cn(
                  'h-[3px] rounded-full transition-all duration-500',
                  idx === activeIdx
                    ? 'w-10 bg-[#8D381B]'
                    : 'w-6 bg-[#D8CCC0] group-hover:bg-[#8D381B]/50'
                )}
              />
            </button>
          ))}
        </div>

        {/* View All Services Link */}
        <div className="mt-10 text-center">
          <Link
            href="/services"
            className="inline-flex items-center gap-2 rounded-full border border-[#D8C7B8] bg-white/80 px-6 py-3 text-xs sm:text-sm font-semibold text-[#8D381B] shadow-xs transition-all hover:bg-white hover:border-[#8D381B] hover:shadow-sm"
          >
            <span>Xem đầy đủ bảng giá và chi tiết liệu trình</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
