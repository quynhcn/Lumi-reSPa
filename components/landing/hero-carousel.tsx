'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SlideData {
  id: number;
  eyebrow: string;
  titleLine1: string;
  titleLine2: string;
  description: string;
  button1Text: string;
  button1Href: string;
  button2Text: string;
  button2Href: string;
  promoText: string;
  thumbLabel: string;
  image: string;
}

const SLIDES: SlideData[] = [
  {
    id: 1,
    eyebrow: 'SPA & WELLNESS • QUẬN 1',
    titleLine1: 'Một khoảng lặng',
    titleLine2: 'dành riêng cho bạn.',
    description:
      'Tạm gác nhịp sống vội. Chọn liệu trình phù hợp và tận hưởng thời gian chăm sóc cơ thể, làn da và tinh thần tại Lumière Spa.',
    button1Text: 'Đặt lịch trải nghiệm',
    button1Href: '/booking',
    button2Text: 'Xem bảng giá',
    button2Href: '/services',
    promoText: 'Giảm 10% cho lần đặt online đầu tiên, tự động áp dụng.',
    thumbLabel: 'Chăm sóc cơ thể',
    image: '/spa-hero-1.jpg',
  },
  {
    id: 2,
    eyebrow: 'FACIAL CARE & TRẺ HÓA',
    titleLine1: 'Làn da rạng ngời',
    titleLine2: 'tươi trẻ & thuần khiết.',
    description:
      'Liệu trình phục hồi chuyên sâu với thảo mộc quý và kỹ thuật massage nâng cơ, giúp thải độc, cấp ẩm và tái tạo sức sống cho làn da.',
    button1Text: 'Đặt lịch chăm sóc da',
    button1Href: '/booking',
    button2Text: 'Xem liệu trình',
    button2Href: '/services',
    promoText: 'Tặng buổi tư vấn soi da chuyên sâu khi đặt online.',
    thumbLabel: 'Chăm sóc da mặt',
    image: '/spa-hero-2.jpg',
  },
  {
    id: 3,
    eyebrow: 'KIẾN TRÚC & KHÔNG GIAN RIÊNG TƯ',
    titleLine1: 'Chốn bình yên',
    titleLine2: 'tách biệt phố thị ồn ào.',
    description:
      'Không gian ấm cúng ngập tràn hương thảo mộc tự nhiên và âm nhạc dịu êm, mang lại trải nghiệm thư thái tuyệt đối cho mọi giác quan.',
    button1Text: 'Khám phá không gian',
    button1Href: '/about',
    button2Text: 'Đặt phòng riêng',
    button2Href: '/booking',
    promoText: 'Miễn phí nâng cấp phòng đôi cho cặp đôi và bạn bè.',
    thumbLabel: 'Không gian thư giãn',
    image: '/spa-hero-3.jpg',
  },
  {
    id: 4,
    eyebrow: 'SIGNATURE WELLNESS RITUALS',
    titleLine1: 'Thăng hoa cảm xúc',
    titleLine2: 'cùng thảo mộc thiên nhiên.',
    description:
      'Kết hợp tinh hoa bấm huyệt cổ truyền và tinh dầu trị liệu độc bản từ thảo dược tự nhiên, đánh thức nguồn năng lượng tươi mới trong bạn.',
    button1Text: 'Trải nghiệm ngay',
    button1Href: '/booking',
    button2Text: 'Tư vấn miễn phí',
    button2Href: '/services',
    promoText: 'Ưu đãi gói trải nghiệm Signature giảm đến 15%.',
    thumbLabel: 'Liệu trình đặc biệt',
    image: '/spa-hero-4.jpg',
  },
];

export function HeroCarousel({ offerPct = 0 }: { offerPct?: number }) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-advance every 5.5s unless hovered
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % SLIDES.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [isPaused]);

  const prevSlide = () => {
    setCurrent((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
  };

  const nextSlide = () => {
    setCurrent((prev) => (prev + 1) % SLIDES.length);
  };

  const activeSlide = SLIDES[current];
  const promo = offerPct > 0 ? `Giảm ${offerPct}% cho lần đặt online đầu tiên, tự động áp dụng.` : '';

  return (
    <section
      className="relative w-full overflow-hidden bg-[#181310]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background Slides with crossfade transition */}
      <div className="relative min-h-[580px] sm:min-h-[640px] lg:min-h-[720px] w-full">
        {SLIDES.map((slide, idx) => (
          <div
            key={slide.id}
            className={cn(
              'absolute inset-0 transition-opacity duration-1000 ease-in-out',
              idx === current ? 'opacity-100 z-0' : 'opacity-0 -z-10'
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slide.image}
              alt={slide.thumbLabel}
              className="h-full w-full object-cover object-[center_right] lg:object-center brightness-[0.92]"
              fetchPriority={idx === 0 ? 'high' : 'low'}
            />
          </div>
        ))}

        {/* Cinematic Vignette & Text Readability Gradients */}
        {/* Left dark gradient for text legibility */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, rgba(16,11,8,0.92) 0%, rgba(16,11,8,0.82) 34%, rgba(16,11,8,0.48) 58%, rgba(16,11,8,0.12) 78%, transparent 95%)',
          }}
        />
        {/* Bottom gradient for smooth transition to floating bar */}
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#140E0B]/90 via-[#140E0B]/40 to-transparent pointer-events-none" />

        {/* Navigation Arrow: Prev (<) */}
        <button
          type="button"
          onClick={prevSlide}
          aria-label="Slide trước"
          className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-black/35 text-white/90 backdrop-blur-md transition-all hover:bg-black/60 hover:scale-105 active:scale-95"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        {/* Navigation Arrow: Next (>) */}
        <button
          type="button"
          onClick={nextSlide}
          aria-label="Slide tiếp theo"
          className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/70 text-[#1F1A17] shadow-lg backdrop-blur-md transition-all hover:bg-white/95 hover:scale-105 active:scale-95"
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        {/* Main Content Area */}
        <div className="relative mx-auto flex min-h-[580px] sm:min-h-[640px] lg:min-h-[720px] max-w-[1360px] items-center px-6 sm:px-10 lg:px-14 pb-28 pt-8 sm:pt-12">
          <div className="max-w-[580px] z-10">
            {/* Eyebrow */}
            <span className="inline-block text-xs sm:text-[13px] font-bold tracking-[0.25em] text-[#E08A68] uppercase transition-all duration-500">
              {activeSlide.eyebrow}
            </span>

            {/* Headline */}
            <h1 className="mt-4 font-serif text-4xl sm:text-5xl lg:text-[64px] font-medium leading-[1.65] tracking-normal text-white">
              {activeSlide.titleLine1}
              <br />
              <em className="font-normal italic text-[#E58F6F]">{activeSlide.titleLine2}</em>
            </h1>

            {/* Description */}
            <p className="mt-5 max-w-[500px] text-[15px] sm:text-[16px] leading-[1.8] text-[#D8CEC4] transition-all duration-500">
              {activeSlide.description}
            </p>

            {/* Action Buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <Link
                href={activeSlide.button1Href}
                className="inline-flex items-center gap-2 rounded-xl bg-[#8D381B] px-6 py-3.5 text-sm sm:text-base font-semibold text-white shadow-lg transition-all hover:bg-[#762E15] hover:shadow-xl active:scale-[0.98]"
              >
                <span>{activeSlide.button1Text}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href={activeSlide.button2Href}
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-black/35 px-6 py-3.5 text-sm sm:text-base font-semibold text-white backdrop-blur-sm transition-all hover:bg-black/60 hover:border-white/40 active:scale-[0.98]"
              >
                <span>{activeSlide.button2Text}</span>
              </Link>
            </div>

            {/* Promo Banner under CTA */}
            <div className="mt-6 flex items-center gap-2 text-xs sm:text-sm text-[#F0D5C3]">
              <Gift className="h-4 w-4 text-[#E58F6F] shrink-0" />
              <span>{promo}</span>
            </div>
          </div>

          {/* Bottom Left Carousel Counter & Progress Bars */}
          <div className="absolute left-6 sm:left-10 lg:left-14 bottom-10 z-10 flex items-center gap-3.5 text-xs text-white">
            <div className="font-mono text-xs sm:text-[13px] tracking-wider">
              <span className="font-bold text-white">0{current + 1}</span>
              <span className="text-white/40"> / 04</span>
            </div>

            <div className="flex items-center gap-1.5">
              {SLIDES.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCurrent(idx)}
                  aria-label={`Đi tới slide ${idx + 1}`}
                  className="group py-1 cursor-pointer"
                >
                  <div
                    className={cn(
                      'h-[3px] rounded-full transition-all duration-500',
                      idx === current
                        ? 'w-9 sm:w-11 bg-[#D9774F]'
                        : 'w-4 sm:w-6 bg-white/25 group-hover:bg-white/50'
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Right 4 Thumbnail Cards */}
          <div className="hidden lg:flex items-center gap-3.5 absolute right-8 sm:right-12 bottom-9 z-10">
            {SLIDES.map((slide, idx) => {
              const isActive = idx === current;
              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setCurrent(idx)}
                  className={cn(
                    'group relative h-20 w-32 xl:w-36 overflow-hidden rounded-xl text-left transition-all duration-300 cursor-pointer',
                    isActive
                      ? 'ring-2 ring-white shadow-[0_8px_25px_rgba(0,0,0,0.6)] scale-105'
                      : 'opacity-70 hover:opacity-100 hover:scale-102 ring-1 ring-white/20'
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={slide.image}
                    alt={slide.thumbLabel}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  {/* Dark gradient overlay */}
                  <div
                    className={cn(
                      'absolute inset-0 transition-opacity',
                      isActive ? 'bg-black/40' : 'bg-black/55 group-hover:bg-black/35'
                    )}
                  />
                  {/* Bottom title pill */}
                  <div className="absolute inset-x-0 bottom-0 p-2 text-center">
                    <span
                      className={cn(
                        'block truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-tight tracking-normal shadow-sm',
                        isActive
                          ? 'bg-black/75 text-white ring-1 ring-white/30'
                          : 'bg-black/50 text-white/90'
                      )}
                    >
                      {slide.thumbLabel}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
