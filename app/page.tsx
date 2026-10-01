import Link from 'next/link';
import {
  ArrowRight,
  Cake,
  Calendar,
  CalendarCheck,
  Check,
  CheckCircle2,
  Clock,
  Crown,
  Flame,
  Flower2,
  Gift,
  Heart,
  Layers,
  Leaf,
  MapPin,
  MessageCircle,
  Navigation,
  Percent,
  Phone,
  PhoneCall,
  Play,
  PlayCircle,
  Quote,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Users,
} from 'lucide-react';
import { createServerDb } from '@/lib/server/server-client';
import { SITE } from '@/lib/site-config';
import {
  formatDuration,
  formatPrice,
  categoryLabel,
  type AppSettings,
  type PublicReview,
  type Service,
  type ServicePackage,
  type Staff,
} from '@/lib/types';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Logo } from '@/components/logo';
import { PromoBar } from '@/components/landing/promo-bar';
import { HeroCarousel } from '@/components/landing/hero-carousel';
import { ServiceShowcase } from '@/components/landing/service-showcase';
import { LeadDialog, LeadForm } from '@/components/landing/lead-form';
import { ContactButtons, MobileActionBar, OpenStatus } from '@/components/landing/contact-actions';

// Server-rendered (SEO + no loading flash); refreshed every 5 minutes.
export const revalidate = 300;

type PublicStaff = Pick<Staff, 'id' | 'name' | 'avatar_url' | 'role' | 'bio' | 'specialties' | 'years_experience'>;

async function getData() {
  const supabase = createServerDb();
  const [svc, settings, staff, packages, reviews, summary, customersCount] = await Promise.all([
    supabase.from('services').select('*').eq('is_active', true).order('category').order('price').then((r) => r.data || [], () => []),
    supabase.from('app_settings').select('first_visit_enabled, first_visit_discount_pct').eq('id', 1).maybeSingle().then((r) => r.data, () => null),
    // Only public profile fields — never phone / email
    supabase
      .from('staff')
      .select('id, name, avatar_url, role, bio, specialties, years_experience')
      .eq('is_active', true)
      .order('years_experience', { ascending: false, nullsFirst: false })
      .then((r) => r.data || [], () => []),
    supabase.from('service_packages').select('*, services!inner (name, price, duration_min, is_active)').eq('is_active', true).eq('services.is_active', true).order('price').then((r) => r.data || [], () => []),
    supabase.rpc('get_public_reviews', { p_limit: 6 }).then((r) => r.data || [], () => []),
    supabase.rpc('get_review_summary').then((r) => r.data || [], () => []),
    supabase.from('customers').select('*', { count: 'exact', head: true }).then((r) => r.count || 0, () => 0),
  ]);
  // Fail closed: never advertise a discount when settings could not be read.
  const s = (settings as AppSettings | null) ?? { first_visit_enabled: false, first_visit_discount_pct: 0 };
  const sum = (summary as { average: number | null; total: number }[] | null)?.[0];
  return {
    services: (svc || []) as Service[],
    offerPct: s.first_visit_enabled ? s.first_visit_discount_pct : 0,
    staff: (staff || []) as PublicStaff[],
    packages: (packages || []) as ServicePackage[],
    reviews: (reviews || []) as PublicReview[],
    rating: sum && sum.total > 0 ? { average: Number(sum.average), total: sum.total } : null,
    customersCount,
  };
}

const givenName = (name: string) => name.trim().split(/\s+/).pop() || name;

function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex ${className ?? ''}`} aria-label={`${value} trên 5 sao`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-4 w-4 ${i <= Math.round(value) ? 'fill-[hsl(var(--gold))] text-[hsl(var(--gold))]' : 'text-border'}`} />
      ))}
    </span>
  );
}

export default async function HomePage() {
  const { services, offerPct, staff, packages, reviews, rating, customersCount } = await getData();

  // Local SEO: schema.org DaySpa with address, hours, price list and (real) rating
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DaySpa',
    name: SITE.name,
    url: SITE.url,
    image: `${SITE.url}/spa-hero-new.jpg`,
    telephone: SITE.phone,
    priceRange: services.length
      ? `${formatPrice(Math.min(...services.map((s) => s.price)))} – ${formatPrice(Math.max(...services.map((s) => s.price)))}`
      : undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: SITE.addressParts.street,
      addressLocality: SITE.addressParts.district,
      addressRegion: SITE.addressParts.city,
      addressCountry: SITE.addressParts.country,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens: SITE.open,
        closes: SITE.close,
      },
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Dịch vụ spa',
      itemListElement: services.map((s) => ({
        '@type': 'Offer',
        price: s.price,
        priceCurrency: 'VND',
        itemOffered: { '@type': 'Service', name: s.name, description: s.description ?? undefined },
      })),
    },
    ...(rating ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: rating.average, reviewCount: rating.total } } : {}),
  };

  return (
    <div className="min-h-screen bg-background pb-16 sm:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {offerPct > 0 && <PromoBar pct={offerPct} />}
      <SiteHeader />

      {/* Interactive Hero Carousel (4 slides, auto-advance, thumbnails & navigation) */}
      <HeroCarousel offerPct={offerPct} />

      {/* Floating Value Bar matching mockup */}
      <section className="relative -mt-8 sm:-mt-12 z-20 mx-auto max-w-[1360px] px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-[#EDE5DA] bg-[#FAF7F2] p-6 shadow-[0_15px_45px_rgba(40,25,15,0.06)] sm:p-7">
          {/* Subtle floral watermark corner accents */}
          <div className="pointer-events-none absolute -left-6 -bottom-6 h-28 w-28 opacity-10 text-[#8D381B]">
            <Flower2 className="h-full w-full" />
          </div>
          <div className="pointer-events-none absolute -right-6 -bottom-6 h-28 w-28 opacity-10 text-[#8D381B]">
            <Flower2 className="h-full w-full" />
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6 divide-y sm:divide-y-0 sm:divide-x divide-[#EDE5DA]">
            {/* Feature 1: 100% Thảo Mộc Sạch */}
            <div className="flex items-center gap-4 sm:px-4 first:pl-0">
              <span className="flex h-12 w-12 sm:h-13 sm:w-13 shrink-0 items-center justify-center rounded-full bg-[#F5ECE2] text-[#923D20] ring-1 ring-[#E8DCCE]/60">
                <Leaf className="h-6 w-6 stroke-[1.75]" />
              </span>
              <div>
                <strong className="block text-sm font-bold text-[#1F1A17] sm:text-[15px]">100% Thảo Mộc Sạch</strong>
                <span className="text-xs text-[#7A6E65]">Được lựa chọn từ thiên nhiên</span>
              </div>
            </div>

            {/* Feature 2: Bảng Giá Minh Bạch */}
            <div className="flex items-center gap-4 sm:px-4 pt-4 sm:pt-0">
              <span className="flex h-12 w-12 sm:h-13 sm:w-13 shrink-0 items-center justify-center rounded-full bg-[#F5ECE2] text-[#923D20] ring-1 ring-[#E8DCCE]/60">
                <ShieldCheck className="h-6 w-6 stroke-[1.75]" />
              </span>
              <div>
                <strong className="block text-sm font-bold text-[#1F1A17] sm:text-[15px]">Bảng Giá Minh Bạch</strong>
                <span className="text-xs text-[#7A6E65]">Không Tip - Không chèo kéo</span>
              </div>
            </div>

            {/* Feature 3: Đặt Lịch Nhanh Chóng */}
            <div className="flex items-center gap-4 sm:px-4 pt-4 sm:pt-0">
              <span className="flex h-12 w-12 sm:h-13 sm:w-13 shrink-0 items-center justify-center rounded-full bg-[#F5ECE2] text-[#923D20] ring-1 ring-[#E8DCCE]/60">
                <Calendar className="h-6 w-6 stroke-[1.75]" />
              </span>
              <div>
                <strong className="block text-sm font-bold text-[#1F1A17] sm:text-[15px]">Đặt Lịch Nhanh Chóng</strong>
                <span className="text-xs text-[#7A6E65]">Chỉ vài phút, dễ dàng online</span>
              </div>
            </div>

            {/* Feature 4: Đội Ngũ Kỹ Thuật Viên */}
            <div className="flex items-center gap-4 sm:px-4 pt-4 sm:pt-0">
              <span className="flex h-12 w-12 sm:h-13 sm:w-13 shrink-0 items-center justify-center rounded-full bg-[#F5ECE2] text-[#923D20] ring-1 ring-[#E8DCCE]/60">
                <Heart className="h-6 w-6 stroke-[1.75]" />
              </span>
              <div>
                <strong className="block text-sm font-bold text-[#1F1A17] sm:text-[15px]">Đội Ngũ Kỹ Thuật Viên</strong>
                <span className="text-xs text-[#7A6E65]">Tận tâm &amp; giàu kinh nghiệm</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Intro / Welcome Teaser matching mockup */}
      <section id="ve-chung-toi" className="relative scroll-mt-14 overflow-hidden bg-[#FAF6F0] py-20 lg:py-28">
        {/* Soft sun-dappled foliage shadow effect in top-left corner */}
        <div className="pointer-events-none absolute -left-16 -top-16 h-80 w-80 rounded-full bg-[#EBDDCF]/60 blur-3xl" />
        
        {/* Subtle decorative branch shadow */}
        <div className="pointer-events-none absolute left-0 top-0 h-64 w-64 opacity-[0.04] text-[#1F1A17]">
          <Flower2 className="h-full w-full rotate-45" />
        </div>

        <div className="relative mx-auto max-w-[1360px] px-6 sm:px-10 lg:px-12">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
            {/* Left Column: Typography, Story & Metrics */}
            <div className="lg:col-span-6 xl:col-span-7">
              {/* Eyebrow with Lotus */}
              <div className="flex items-center gap-2.5">
                <Flower2 className="h-4 w-4 text-[#8D381B]" />
                <span className="text-xs sm:text-[13px] font-bold tracking-[0.25em] text-[#8D381B] uppercase">
                  CHÀO MỪNG ĐẾN LUMIÈRE SPA
                </span>
                <span className="hidden sm:inline-block h-[1px] w-12 bg-[#8D381B]/40" />
              </div>

              {/* Main Headline */}
              <h2 className="mt-4 font-serif text-3xl sm:text-4xl lg:text-[52px] font-medium leading-[1.65] tracking-normal text-[#1F1A17]">
                <span className="block pb-2 sm:pb-3">Một nhịp nghỉ vừa vặn</span>
                <span className="font-semibold text-[#8D381B]">giữa phố thị.</span>
              </h2>

              {/* Paragraphs */}
              <div className="mt-6 space-y-4 text-[15px] sm:text-[16px] leading-[1.8] text-[#5C5248]">
                <p>
                  Lumière Spa được tạo dựng như một trạm dừng chân an yên, nơi bạn tạm gác lại những vội vã và đời thường để lắng nghe cơ thể, chăm sóc từng thớ cơ và làm mới nguồn năng lượng tươi trẻ bên trong mình.
                </p>
                <p>
                  Mỗi liệu trình là sự hòa quyện giữa tinh hoa thảo mộc, tinh dầu thiên nhiên và bàn tay trị liệu giàu kinh nghiệm, đưa bạn về trạng thái thư thái, cân bằng và trọn vẹn nhất.
                </p>
              </div>

              {/* Stats / Metric Badges */}
              <div className="mt-8 flex flex-wrap items-center gap-4 sm:gap-6 py-2">
                {/* Metric 1 */}
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EFE6DC] text-[#8D381B]">
                    <Users className="h-5 w-5" />
                  </span>
                  <div>
                    <strong className="block text-xl sm:text-2xl font-bold text-[#1F1A17] leading-none">
                      {new Intl.NumberFormat('vi-VN').format(customersCount)}+
                    </strong>
                    <span className="mt-1 block text-xs text-[#7A6E65]">Lượt khách tin yêu</span>
                  </div>
                </div>

                <div className="hidden sm:block h-10 w-[1px] bg-[#E3D7CB]" />

                {/* Metric 2 */}
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EFE6DC] text-[#8D381B]">
                    <Star className="h-5 w-5 fill-[#8D381B]" />
                  </span>
                  <div>
                    <strong className="block text-xl sm:text-2xl font-bold text-[#1F1A17] leading-none">
                      {rating?.average || '5.0'} ★
                    </strong>
                    <span className="mt-1 block text-xs text-[#7A6E65]">
                      {new Intl.NumberFormat('vi-VN').format(rating?.total || 0)}+ đánh giá
                    </span>
                  </div>
                </div>

                <div className="hidden sm:block h-10 w-[1px] bg-[#E3D7CB]" />

                {/* Metric 3 */}
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EFE6DC] text-[#8D381B]">
                    <Leaf className="h-5 w-5" />
                  </span>
                  <div>
                    <strong className="block text-xl sm:text-2xl font-bold text-[#1F1A17] leading-none">100%</strong>
                    <span className="mt-1 block text-xs text-[#7A6E65]">Tinh dầu ép lạnh</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-9 flex flex-wrap items-center gap-3.5 sm:gap-4">
                <Link
                  href="/about"
                  className="inline-flex items-center gap-2 rounded-full bg-[#8D381B] px-7 py-3.5 text-sm sm:text-base font-semibold text-white shadow-md transition-all hover:bg-[#762E15] hover:shadow-lg active:scale-95"
                >
                  <span>Khám phá câu chuyện Lumière Spa</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/services"
                  className="inline-flex items-center gap-2 rounded-full border border-[#D8C7B8] bg-white/70 px-6 py-3.5 text-sm sm:text-base font-semibold text-[#8D381B] transition-all hover:bg-white active:scale-95"
                >
                  <span>Xem toàn bộ bảng dịch vụ</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Right Column: Rounded Photo & Floating Glass Card */}
            <div className="relative lg:col-span-6 xl:col-span-5">
              {/* Main Rounded Photo */}
              <div className="relative overflow-hidden rounded-[32px] border border-[#EBE3D8] shadow-[0_20px_50px_rgba(40,25,15,0.09)] aspect-[4/3] sm:aspect-[16/12]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/spa-welcome-oil.jpg"
                  alt="Trải nghiệm trị liệu tinh dầu thảo mộc tại Lumière Spa"
                  className="h-full w-full object-cover object-center"
                />
              </div>

              {/* Floating Lotus Circle Badge at top-right corner of image */}
              <div className="absolute -top-3.5 -right-3.5 z-10 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-[#8D381B] text-white shadow-lg ring-4 ring-[#FAF6F0]">
                <Flower2 className="h-6 w-6 stroke-[1.75]" />
              </div>

              {/* Floating Card Overlapping image */}
              <div className="relative mt-4 sm:absolute sm:right-6 sm:bottom-8 sm:mt-0 z-20 w-full sm:max-w-[340px] rounded-2xl border border-[#EDE5DA] bg-white/95 backdrop-blur-md p-5 shadow-[0_16px_40px_rgba(40,25,15,0.12)]">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#9E724E] text-white shadow-sm">
                    <Leaf className="h-5 w-5" />
                  </span>
                  <div>
                    <h4 className="text-sm sm:text-[15px] font-bold text-[#1F1A17]">Hương thảo mộc dịu nhẹ</h4>
                    <p className="font-serif italic text-xs text-[#8D381B]">Âm nhạc thiền an yên</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[#F0EAE1] pt-3 text-xs text-[#7A6E65]">
                  <div>
                    <span className="block font-medium">Phục vụ từ {SITE.open} – {SITE.close}</span>
                    <span>hằng ngày tại {SITE.addressParts.district}</span>
                  </div>
                  <Link
                    href="/services"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-[#D9CDC0] text-[#8D381B] transition-colors hover:bg-[#8D381B] hover:text-white"
                    title="Xem dịch vụ"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Script slogan watermark at bottom right */}
          <div className="mt-10 sm:mt-14 text-right hidden sm:block">
            <span className="font-serif italic text-2xl sm:text-3xl text-[#923D20]/50 tracking-wider font-light select-none">
              More than a spa, A kinder you
            </span>
          </div>
        </div>
      </section>

      {/* 5-Card Interactive Service Showcase */}
      <ServiceShowcase services={services} />

      {/* Offers: first visit · gift cards · membership */}
      <section id="uu-dai" className="relative scroll-mt-20 overflow-hidden bg-[#FAF6F0] py-20 lg:py-28">
        {/* Soft background foliage ambiance */}
        <div className="pointer-events-none absolute -left-20 top-1/3 h-96 w-96 rounded-full bg-[#EFE3D5]/50 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-10 h-96 w-96 rounded-full bg-[#EBDDCF]/50 blur-3xl" />

        <div className="relative mx-auto max-w-[1360px] px-6 sm:px-10 lg:px-12">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-3 justify-center">
              <span className="h-[1px] w-8 sm:w-14 bg-[#8D381B]/40" />
              <span className="text-xs sm:text-[13px] font-bold tracking-[0.25em] text-[#8D381B] uppercase">
                ƯU ĐÃI &amp; QUÀ TẶNG
              </span>
              <span className="h-[1px] w-8 sm:w-14 bg-[#8D381B]/40" />
            </div>

            <h2 className="mt-3 font-serif text-3xl sm:text-4xl lg:text-[48px] font-medium leading-[1.65] tracking-normal text-[#1F1A17]">
              <span className="block pb-2 sm:pb-3">Nuông chiều bản thân,</span>
              <span>nhận thêm ưu đãi.</span>
            </h2>

            <p className="mt-3.5 text-center text-[15px] sm:text-[16px] leading-[1.75] text-[#6B5F54]">
              Đặt lịch thông minh, tận hưởng nhiều hơn tại Lumière Spa.
              <br className="hidden sm:inline" />
              {' '}Những ưu đãi đặc biệt dành riêng cho bạn, để mỗi lần ghé thăm đều là một trải nghiệm trọn vẹn.
            </p>
          </div>

          {/* 3 Main Cards */}
          <div className="mt-12 sm:mt-16 grid grid-cols-1 gap-6 sm:gap-7 lg:grid-cols-3 items-stretch">
            {/* Card 1: Lần đầu đặt online - Giảm 10% */}
            <article className="relative rounded-[28px] bg-[#241710] text-white p-7 sm:p-8 flex flex-col justify-between overflow-hidden shadow-[0_20px_50px_rgba(30,18,10,0.18)] min-h-[520px]">
              {/* Right faded background photo of towel, plumeria & candle */}
              <div className="absolute right-0 top-0 bottom-0 w-[55%] opacity-35 pointer-events-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/offer-first-visit.jpg"
                  alt="Không gian thư giãn Lumière Spa"
                  className="h-full w-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#241710] via-[#241710]/75 to-transparent" />
              </div>

              <div className="relative z-10">
                {/* Eyebrow Badge */}
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-[#EBD7C4] border border-white/15 backdrop-blur-md">
                  <Leaf className="h-3 w-3 text-[#E8C296]" />
                  <span>Dành cho khách mới</span>
                </span>

                {/* Title */}
                <h3 className="mt-5 font-serif text-2xl sm:text-3xl font-normal leading-tight text-white">
                  Lần đầu đặt
                  <br />
                  lịch online
                </h3>

                {/* Big Discount Highlight */}
                <div className="my-5 flex items-baseline gap-2">
                  <span className="font-serif italic text-3xl sm:text-4xl text-[#E8C296]">Giảm</span>
                  <span className="font-serif text-5xl sm:text-6xl font-normal text-[#E8C296] tracking-normal">
                    {offerPct > 0 ? `${offerPct}%` : '10%'}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs sm:text-[13px] leading-relaxed text-[#D6C7B8] max-w-[280px]">
                  Tự động trừ vào giá khi bạn đặt lịch online lần đầu tại Lumière Spa. Không cần nhập mã.
                </p>
              </div>

              {/* Button */}
              <div className="relative z-10 mt-8">
                <Link
                  href="/booking"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#F7EFE6] hover:bg-white text-[#7A2E14] font-semibold py-3.5 px-6 text-sm shadow-md transition-all active:scale-95"
                >
                  <span>Đặt lịch nhận ưu đãi</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </article>

            {/* Card 2: Thẻ quà tặng */}
            <article className="relative rounded-[28px] bg-white border border-[#EDE4D8] p-7 sm:p-8 flex flex-col justify-between shadow-[0_15px_45px_rgba(40,25,15,0.08)] min-h-[520px]">
              <div>
                {/* Top Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Gift className="h-5 w-5 text-[#8D381B]" />
                    <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#1F1A17]">Thẻ quà tặng</h3>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#FAECE4] text-[#C25827] text-xs font-bold px-2.5 py-0.5">
                    <Flame className="h-3.5 w-3.5 fill-[#C25827]" />
                    <span>Phổ biến</span>
                  </span>
                </div>

                <p className="mt-1 text-xs sm:text-[13px] text-[#7A6E65]">
                  Món quà tinh tế cho những người thân yêu.
                </p>

                {/* Photo */}
                <div className="my-4 overflow-hidden rounded-2xl border border-[#F0EAE1] h-36 sm:h-40 w-full shadow-inner">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/offer-gift-card.jpg"
                    alt="Thẻ quà tặng Lumière Spa"
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                </div>

                {/* Body */}
                <p className="text-xs sm:text-[13px] leading-relaxed text-[#5C5248]">
                  Tặng người thân một buổi thư giãn dịp sinh nhật, 8/3, 20/10... Người nhận tự đặt lịch online bằng mã trên thẻ.
                </p>

                {/* Checklist */}
                <ul className="mt-3.5 space-y-1.5 text-xs sm:text-[12.5px] text-[#4A4036]">
                  <li className="flex items-center gap-2">
                    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#F5ECE2] text-[#8D381B]">
                      <CheckCircle2 className="h-3 w-3" />
                    </span>
                    <span>Linh hoạt chọn liệu trình và thời gian</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#F5ECE2] text-[#8D381B]">
                      <CheckCircle2 className="h-3 w-3" />
                    </span>
                    <span>Nhận thiệp in hoặc mã quà tặng qua Zalo</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#F5ECE2] text-[#8D381B]">
                      <CheckCircle2 className="h-3 w-3" />
                    </span>
                    <span>Món quà tinh tế, ý nghĩa và dễ dàng trao tặng</span>
                  </li>
                </ul>
              </div>

              {/* Button */}
              <div className="mt-6">
                <LeadDialog source="gift_card" interest="Thẻ quà tặng">
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#8D381B] hover:bg-[#782E15] text-white font-semibold py-3.5 px-6 text-sm shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    <span>Mua thẻ quà tặng</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </LeadDialog>
              </div>
            </article>

            {/* Card 3: Thẻ thành viên */}
            <article className="relative rounded-[28px] bg-white border border-[#EDE4D8] p-7 sm:p-8 flex flex-col justify-between shadow-[0_15px_45px_rgba(40,25,15,0.08)] min-h-[520px]">
              <div>
                {/* Top Header */}
                <div className="flex items-center gap-2.5">
                  <Crown className="h-5 w-5 text-[#8D381B]" />
                  <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#1F1A17]">Thẻ thành viên</h3>
                </div>

                <p className="mt-1 text-xs sm:text-[13px] text-[#7A6E65]">
                  Tích điểm – Nhận ưu đãi – Trải nghiệm nhiều hơn.
                </p>

                {/* Photo */}
                <div className="my-4 overflow-hidden rounded-2xl border border-[#F0EAE1] h-36 sm:h-40 w-full shadow-inner">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/offer-member-card.jpg"
                    alt="Thẻ thành viên Lumière Spa VIP Member"
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                </div>

                {/* 4 Benefit Rows */}
                <div className="space-y-2.5 text-xs sm:text-[12.5px]">
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FAF3EC] text-[#8D381B] mt-0.5">
                      <Gift className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <strong className="block text-[#1F1A17] font-semibold">Tích điểm cho mỗi lần trải nghiệm</strong>
                      <span className="text-[#7A6E65] text-[11px] sm:text-xs">Quy đổi thành ưu đãi hấp dẫn</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FAF3EC] text-[#8D381B] mt-0.5">
                      <Percent className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <strong className="block text-[#1F1A17] font-semibold">Giá ưu đãi độc quyền</strong>
                      <span className="text-[#7A6E65] text-[11px] sm:text-xs">Dành riêng cho thành viên</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FAF3EC] text-[#8D381B] mt-0.5">
                      <Cake className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <strong className="block text-[#1F1A17] font-semibold">Quà sinh nhật đặc biệt</strong>
                      <span className="text-[#7A6E65] text-[11px] sm:text-xs">Một lời tri ân từ Lumière Spa</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FAF3EC] text-[#8D381B] mt-0.5">
                      <Heart className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <strong className="block text-[#1F1A17] font-semibold">Ưu tiên đặt lịch &amp; sự kiện riêng</strong>
                      <span className="text-[#7A6E65] text-[11px] sm:text-xs">Trải nghiệm trọn vẹn và chu đáo hơn</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Button */}
              <div className="mt-6">
                <Link
                  href="/account"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#D8C7B8] bg-[#FAF7F2] hover:bg-white text-[#7A2E14] font-semibold py-3.5 px-6 text-sm transition-all active:scale-95"
                >
                  <span>Xem quyền lợi</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          </div>

          {/* Bottom 3-Item Trust / Value Bar matching mockup */}
          <div className="mt-12 sm:mt-16 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#EDE4D8] border-t border-[#EDE4D8] pt-8">
            {/* Item 1 */}
            <div className="flex items-center justify-center gap-3.5 py-4 sm:py-0 px-4 text-center sm:text-left">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FAF3EC] text-[#8D381B]">
                <Leaf className="h-5 w-5" />
              </span>
              <div>
                <strong className="block text-sm font-bold text-[#1F1A17]">Trải nghiệm tinh tế</strong>
                <span className="text-xs text-[#7A6E65]">Không gian thư giãn đẳng cấp</span>
              </div>
            </div>

            {/* Item 2 */}
            <div className="flex items-center justify-center gap-3.5 py-4 sm:py-0 px-4 text-center sm:text-left">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FAF3EC] text-[#8D381B]">
                <Flower2 className="h-5 w-5" />
              </span>
              <div>
                <strong className="block text-sm font-bold text-[#1F1A17]">Chăm sóc toàn diện</strong>
                <span className="text-xs text-[#7A6E65]">Thân – Tâm – Làn da</span>
              </div>
            </div>

            {/* Item 3 */}
            <div className="flex items-center justify-center gap-3.5 py-4 sm:py-0 px-4 text-center sm:text-left">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FAF3EC] text-[#8D381B]">
                <Heart className="h-5 w-5" />
              </span>
              <div>
                <strong className="block text-sm font-bold text-[#1F1A17]">Gắn kết lâu dài</strong>
                <span className="text-xs text-[#7A6E65]">Nhiều ưu đãi dành riêng cho bạn</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Team */}
      {staff.length > 0 && (
        <section id="doi-ngu" className="scroll-mt-20 bg-[#FAF7F2] py-20 lg:py-28 relative overflow-hidden">
          {/* Decorative background element */}
          <div className="pointer-events-none absolute -right-20 top-20 h-72 w-72 rounded-full bg-[#EFE6DC]/50 blur-3xl" />
          
          <div className="relative z-10 mx-auto max-w-[1360px] px-6 sm:px-8 lg:px-12">
            <div className="mb-14 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <span className="text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] text-[#8D381B]">
                  ĐỘI NGŨ KỸ THUẬT VIÊN
                </span>
                <h2 className="mt-4 font-serif text-3xl sm:text-4xl lg:text-5xl font-normal text-[#1E130D]">
                  Đôi tay bạn có thể <span className="italic font-serif text-[#8D381B]">tin tưởng.</span>
                </h2>
              </div>
              <p className="max-w-[390px] text-sm leading-relaxed text-[#736357] font-light">
                Mỗi kỹ thuật viên tại Lumière Spa đều được đào tạo chuyên sâu. Bạn hoàn toàn có thể chọn người quen thuộc của mình khi đặt lịch.
              </p>
            </div>
            
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {staff.map((m) => (
                <article
                  key={m.id}
                  className="group flex flex-col rounded-[24px] border border-[#EFE5D8] bg-white p-6 shadow-[0_4px_24px_rgba(30,19,13,0.03)] transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_16px_40px_rgba(30,19,13,0.08)] hover:border-[#DCC6B3]"
                >
                  <div className="flex items-center gap-4">
                    {m.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.avatar_url}
                        alt={m.name}
                        width={72}
                        height={72}
                        className="h-16 w-16 sm:h-18 sm:w-18 rounded-full object-cover shadow-sm transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <span className="flex h-16 w-16 sm:h-18 sm:w-18 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#F5ECE1] to-[#EAE0D3] font-serif text-2xl font-bold text-[#8D381B] shadow-inner transition-transform duration-500 group-hover:scale-105">
                        {givenName(m.name).charAt(0)}
                      </span>
                    )}
                    <div>
                      <h3 className="font-serif text-lg sm:text-xl font-semibold text-[#1E130D] group-hover:text-[#8D381B] transition-colors">
                        {m.name}
                      </h3>
                      <p className="text-[13px] text-[#8A796D] mt-0.5">
                        {m.role === 'therapist' ? 'Kỹ thuật viên' : m.role}
                        {m.years_experience ? ` · ${m.years_experience} năm K.N` : ''}
                      </p>
                    </div>
                  </div>
                  
                  {(m.specialties?.length ?? 0) > 0 && (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {m.specialties!.map((sp) => (
                        <span
                          key={sp}
                          className="rounded-full border border-[#F0EAE1] bg-[#FAF6F0] px-3 py-1 text-[11px] font-medium text-[#736357]"
                        >
                          {sp}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {m.bio && (
                    <p className="mt-5 text-[13px] leading-relaxed text-[#736357] font-light line-clamp-3">
                      {m.bio}
                    </p>
                  )}
                  
                  <div className="mt-auto pt-6">
                    <Link
                      href={`/booking?staff=${m.id}`}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FAF5EE] px-4 py-2.5 text-xs font-semibold text-[#8D381B] transition-all duration-300 group-hover:bg-[#8D381B] group-hover:text-white"
                    >
                      <span>Đặt lịch với {givenName(m.name)}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Feature Banner - Relax in Your Own Way */}
      <section className="relative overflow-hidden bg-[#1E130D] py-16 sm:py-20 lg:py-24 text-white">
        {/* Atmospheric Spa Still-life Background */}
        <div
          className="absolute inset-0 bg-cover bg-left bg-no-repeat opacity-50 sm:opacity-75 lg:opacity-90"
          style={{ backgroundImage: "url('/spa-banner-relax.jpg')" }}
        />
        {/* Dark Gradient Overlay for optimal text legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#1E130D]/75 via-[#1E130D]/90 to-[#1E130D] lg:from-[#1E130D]/30 lg:via-[#1E130D]/80 lg:to-[#1E130D]" />

        <div className="relative z-10 mx-auto max-w-[1360px] px-6 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-14">
            {/* Left Column: Heading & CTA */}
            <div className="lg:col-span-6 xl:col-span-6">
              <span className="text-xs sm:text-sm font-semibold tracking-[0.2em] text-[#E8A87C] uppercase">
                TẬN HƯỞNG THEO CÁCH CỦA BẠN
              </span>
              <h2 className="mt-4 font-serif text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.65] text-[#FAF6F0]">
                <span className="block pb-2 sm:pb-3">Thời gian nghỉ ngơi</span>
                <span className="block pb-2 sm:pb-3">cũng xứng đáng được</span>
                <span className="font-serif italic text-[#E8A87C]">chăm chút.</span>
              </h2>
              <p className="mt-6 max-w-[490px] text-sm sm:text-base leading-relaxed text-[#D8CCC4] font-light">
                Dành cho những buổi nghỉ ngắn giữa tuần hay một khoảng thư giãn cuối tuần. Chỉ cần chọn dịch vụ, chọn thời gian và để chúng tôi chuẩn bị phần còn lại.
              </p>
              <div className="mt-8">
                <Link
                  href="/booking"
                  className="group inline-flex items-center gap-3 rounded-full bg-[#F5EBE1] px-7 py-3.5 text-sm font-semibold text-[#5A2510] shadow-lg shadow-black/25 transition-all duration-300 hover:bg-white hover:shadow-xl hover:-translate-y-0.5"
                >
                  <span>Giữ chỗ cho tôi</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </div>
            </div>

            {/* Right Column: 3 Horizontal Glass Cards */}
            <div className="flex flex-col gap-4 sm:gap-5 lg:col-span-6 xl:col-span-6">
              {[
                {
                  num: '01',
                  title: 'Lựa chọn linh hoạt',
                  desc: 'Liệu trình từ 30 đến 90 phút, dễ sắp xếp trong lịch trình của bạn.',
                  icon: Calendar,
                },
                {
                  num: '02',
                  title: 'Giá rõ ràng',
                  desc: 'Giá niêm yết trên web, không phát sinh chi phí ẩn.',
                  icon: Tag,
                },
                {
                  num: '03',
                  title: 'Đặt lịch thuận tiện',
                  desc: 'Chọn giờ trống và nhận mã đặt lịch ngay, không cần chờ gọi lại.',
                  icon: CalendarCheck,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.num}
                    className="group relative flex items-center gap-5 sm:gap-6 rounded-2xl border border-white/10 bg-[#281810]/70 p-5 sm:p-6 backdrop-blur-md transition-all duration-300 hover:border-white/20 hover:bg-[#342016]/85 hover:shadow-xl"
                  >
                    {/* Serif Number */}
                    <span className="shrink-0 font-serif text-2xl sm:text-3xl font-light text-[#E8A87C]/90 w-8">
                      {item.num}
                    </span>

                    {/* Icon in Rounded Box */}
                    <span className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-[#E8A87C] transition-colors duration-300 group-hover:bg-[#E8A87C]/20 group-hover:border-[#E8A87C]/40">
                      <Icon className="h-5 w-5" />
                    </span>

                    {/* Text Content */}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base sm:text-lg font-semibold text-white">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-xs sm:text-sm text-[#C8BCB3] leading-relaxed font-light">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Journey - 3 Steps to Begin */}
      <section id="trai-nghiem" className="relative scroll-mt-20 overflow-hidden bg-[#FAF6F0] py-20 lg:py-24">
        {/* Subtle decorative background accents */}
        <div className="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-[#EFE6DC]/50 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-[#EADCCB]/40 blur-3xl" />

        <div className="relative mx-auto max-w-[1360px] px-6 sm:px-8 lg:px-12">
          {/* Section Header */}
          <div className="text-center">
            <span className="text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] text-[#8D381B]">
              MỘT BUỔI HẸN THẬT NHẸ NHÀNG
            </span>
            <h2 className="mt-3 font-serif text-3xl sm:text-4xl lg:text-5xl font-normal text-[#1E130D]">
              Ba bước để <span className="italic font-serif text-[#8D381B]">bắt đầu.</span>
            </h2>
          </div>

          {/* Steps Cards Grid with Connecting Horizontal Guide */}
          <div className="relative mt-12 sm:mt-16">
            {/* Desktop connecting guide line */}
            <div className="pointer-events-none absolute left-[15%] right-[15%] top-1/2 hidden -translate-y-1/2 border-t border-[#DFD3C4] lg:block" />

            <div className="relative grid grid-cols-1 gap-6 sm:grid-cols-3 lg:gap-8">
              {[
                {
                  step: '01 / Chọn',
                  title: 'Tìm liệu trình',
                  desc: 'Xem dịch vụ, thời lượng và mức giá phù hợp với bạn.',
                  icon: Flower2,
                  href: '#dich-vu',
                },
                {
                  step: '02 / Hẹn',
                  title: 'Chọn giờ còn trống',
                  desc: 'Xem khung giờ trống theo thời gian thực, lịch được xác nhận ngay.',
                  icon: Calendar,
                  href: '/booking',
                },
                {
                  step: '03 / Thư giãn',
                  title: 'Đến Lumière Spa',
                  desc: 'Đến trước giờ hẹn 10 phút và dành thời gian cho chính mình.',
                  icon: Leaf,
                  href: '/about',
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.step}
                    className="group relative flex flex-col justify-between rounded-[24px] border border-[#EFE5D8] bg-[#FDFBF7] p-7 sm:p-8 shadow-[0_4px_24px_rgba(30,19,13,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-[#DCC6B3] hover:shadow-[0_12px_32px_rgba(30,19,13,0.08)]"
                  >
                    <div>
                      {/* Top Row: Icon Badge & Step Label */}
                      <div className="flex items-center justify-between">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F5ECE1] text-[#8D381B] shadow-inner transition-transform duration-300 group-hover:scale-105">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#A8988A]">
                          {item.step}
                        </span>
                      </div>

                      {/* Title & Description */}
                      <h3 className="mt-5 font-serif text-xl sm:text-2xl font-medium text-[#1E130D]">
                        {item.title}
                      </h3>
                      <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-[#736357] font-light min-h-[42px]">
                        {item.desc}
                      </p>
                    </div>

                    {/* Bottom Row: Arrow action button */}
                    <div className="mt-6 flex justify-end">
                      <Link
                        href={item.href}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EFE6DC] text-[#736357] transition-all duration-300 group-hover:bg-[#8D381B] group-hover:text-white group-hover:scale-110"
                        aria-label={item.title}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>



      {/* Contact + callback form */}
      <section id="lien-he" className="relative scroll-mt-20 overflow-hidden bg-[#FAF5EE] py-20 lg:py-28">
        {/* Atmospheric Spa Architectural Background */}
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-left bg-no-repeat opacity-40 lg:opacity-70"
          style={{ backgroundImage: "url('/spa-contact-bg.jpg')" }}
        />
        {/* Soft Warm Gradient Overlay for readability */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#FAF5EE]/50 via-[#FAF5EE]/85 to-[#FAF5EE] lg:from-[#FAF5EE]/30 lg:via-[#FAF5EE]/75 lg:to-[#FAF5EE]" />

        {/* Artistic botanical line branch in top right corner */}
        <div className="pointer-events-none absolute right-4 top-6 hidden opacity-25 lg:block">
          <svg width="180" height="220" viewBox="0 0 180 220" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M40 180C70 140 110 100 160 80C140 110 110 140 70 170" stroke="#8D381B" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M90 120C120 90 150 50 170 10C140 30 110 70 80 110" stroke="#8D381B" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M20 210C60 170 110 110 150 40" stroke="#8D381B" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>

        <div className="relative z-10 mx-auto max-w-[1360px] px-6 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12 lg:gap-14">
            {/* Left Column: Contact details & directions */}
            <div className="lg:col-span-7 xl:col-span-7">
              {/* Eyebrow */}
              <div className="flex items-center gap-3">
                <span className="text-xs sm:text-sm font-semibold tracking-[0.2em] text-[#A67C52] uppercase">
                  LIÊN HỆ & ĐẶT HẸN
                </span>
                <span className="h-px w-10 sm:w-16 bg-[#DECFC0]" />
              </div>

              {/* Main Headline */}
              <h2 className="mt-4 font-serif text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.65] text-[#20140D]">
                <span className="block pb-2 sm:pb-3">Hôm nay, hãy dành</span>
                <span>
                  thời gian cho <span className="font-serif italic text-[#8D381B]">chính mình</span>
                  <span className="inline-block ml-2.5 align-middle text-[#8D381B]/80">
                    <Leaf className="h-6 w-6 sm:h-7 sm:w-7 inline-block -rotate-12" />
                  </span>
                </span>
              </h2>

              {/* Sub-paragraph */}
              <p className="mt-5 max-w-[540px] text-sm sm:text-base leading-relaxed text-[#736357] font-light">
                Lumière Spa luôn sẵn sàng đồng hành cùng bạn trên hành trình chăm sóc sức khỏe và tái tạo năng lượng. Liên hệ với chúng tôi để được tư vấn dịch vụ phù hợp nhất.
              </p>

              {/* Opening Status */}
              <div className="mt-6 flex items-center gap-2 text-xs sm:text-sm font-medium text-[#20140D]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#2F7D32] animate-pulse" />
                <span>Đang mở cửa · đóng lúc {SITE.close || '20:00'}</span>
              </div>

              {/* 3 Info Cards */}
              <div className="mt-8 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                {/* Địa chỉ */}
                <div className="flex flex-col justify-between rounded-2xl border border-[#EAE0D3] bg-[#FDFBF7]/90 p-4 shadow-[0_2px_12px_rgba(40,20,10,0.03)] backdrop-blur-sm">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5ECE1] text-[#8D381B]">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div className="mt-3">
                    <span className="block text-xs text-[#8A796D]">Địa chỉ</span>
                    <strong className="mt-1 block text-xs sm:text-sm font-semibold text-[#20140D] leading-snug">
                      {SITE.address}
                    </strong>
                  </div>
                </div>

                {/* Hotline */}
                <div className="flex flex-col justify-between rounded-2xl border border-[#EAE0D3] bg-[#FDFBF7]/90 p-4 shadow-[0_2px_12px_rgba(40,20,10,0.03)] backdrop-blur-sm">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5ECE1] text-[#8D381B]">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div className="mt-3">
                    <span className="block text-xs text-[#8A796D]">Hotline</span>
                    <strong className="mt-1 block text-sm sm:text-base font-bold text-[#20140D]">
                      {SITE.phone}
                    </strong>
                    <span className="block text-[11px] text-[#8A796D]">(8:00 - 20:00)</span>
                  </div>
                </div>

                {/* Giờ mở cửa */}
                <div className="flex flex-col justify-between rounded-2xl border border-[#EAE0D3] bg-[#FDFBF7]/90 p-4 shadow-[0_2px_12px_rgba(40,20,10,0.03)] backdrop-blur-sm">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5ECE1] text-[#8D381B]">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="mt-3">
                    <span className="block text-xs text-[#8A796D]">Giờ mở cửa</span>
                    <strong className="mt-1 block text-xs sm:text-sm font-semibold text-[#20140D]">
                      {SITE.open} – {SITE.close}
                    </strong>
                    <span className="block text-[11px] text-[#8A796D]">hàng ngày</span>
                  </div>
                </div>
              </div>

              {/* 3 Quick Action Buttons */}
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <a
                  href={`tel:${SITE.phone.replace(/\s+/g, '')}`}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#8D381B] px-4 py-3.5 text-xs sm:text-sm font-semibold text-white shadow-md shadow-[#8D381B]/20 transition-all hover:bg-[#772F16] hover:shadow-lg active:scale-[0.99]"
                >
                  <PhoneCall className="h-4 w-4" />
                  <span>Gọi {SITE.phone}</span>
                </a>
                <a
                  href={SITE.zalo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#D9C4B2] bg-[#FDFBF7] px-4 py-3.5 text-xs sm:text-sm font-semibold text-[#8D381B] transition-all hover:bg-[#F5ECE1] hover:border-[#8D381B]/40 active:scale-[0.99]"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Chat Zalo</span>
                </a>
                <a
                  href={SITE.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#D9C4B2] bg-[#FDFBF7] px-4 py-3.5 text-xs sm:text-sm font-semibold text-[#8D381B] transition-all hover:bg-[#F5ECE1] hover:border-[#8D381B]/40 active:scale-[0.99]"
                >
                  <Navigation className="h-4 w-4" />
                  <span>Chỉ đường</span>
                </a>
              </div>

              {/* Google Maps Card with storefront photo */}
              <a
                href={SITE.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group mt-5 flex items-center gap-4 rounded-2xl border border-[#EAE0D3] bg-[#FDFBF7] p-3.5 shadow-sm transition-all duration-300 hover:border-[#D0BAA6] hover:shadow-md"
              >
                <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-xl border border-[#E8DEC1]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/spa-facade-thumb.jpg"
                    alt="Lumière Spa storefront"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#20140D]">
                    <MapPin className="h-4 w-4 shrink-0 text-[#8D381B]" />
                    <span className="truncate">Xem đường đi trên Google Maps</span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#8A796D]">
                    Mở bản đồ để xem đường đi và chỗ gửi xe
                  </p>
                </div>
                <div className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EFE6DC] text-[#736357] transition-all duration-300 group-hover:bg-[#8D381B] group-hover:text-white group-hover:scale-105">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </a>
            </div>

            {/* Right Column: Personalized Consultation Card */}
            <div className="lg:col-span-5 xl:col-span-5">
              <div className="rounded-[28px] sm:rounded-[36px] border border-[#EBE3D7] bg-[#FDFBF7]/95 p-6 sm:p-9 shadow-[0_16px_48px_rgba(40,20,10,0.06)] backdrop-blur-md">
                {/* Eyebrow */}
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#8D381B]">
                  <Flower2 className="h-4 w-4" />
                  <span>TƯ VẤN CÁ NHÂN HÓA</span>
                </div>

                {/* Headline */}
                <h3 className="mt-3 font-serif text-2xl sm:text-3xl font-medium leading-[1.65] text-[#20140D]">
                  <span className="block pb-2 sm:pb-3">Để lại thông tin,</span>
                  <span>Lumière Spa gọi lại tư vấn</span>
                </h3>

                {/* Subtitle */}
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[#736357] font-light">
                  Chưa chắc chọn liệu trình nào, muốn mua gói hoặc thẻ quà tặng? Chuyên viên sẽ gọi lại trong giờ mở cửa để tư vấn chi tiết cho bạn.
                </p>

                {/* Interactive Lead Form with luxury styling */}
                <div className="mt-6">
                  <LeadForm source="contact" idPrefix="contact-lead" luxury />
                </div>

                {/* Bottom Link */}
                <div className="mt-6 border-t border-[#EFE8DF] pt-5 text-center text-xs sm:text-sm text-[#736357]">
                  Đã biết mình muốn gì?{' '}
                  <Link href="/booking" className="font-semibold text-[#8D381B] hover:underline inline-flex items-center gap-1">
                    <span>Đặt lịch online ngay</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Synchronized Site Footer */}
      <SiteFooter />

      <MobileActionBar />
    </div>
  );
}
