'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Coffee,
  Droplets,
  Ear,
  Eye,
  Heart,
  Leaf,
  MapPin,
  Music,
  Phone,
  Quote,
  ShieldCheck,
  Smile,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import { SITE, telHref } from '@/lib/site-config';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Logo } from '@/components/logo';
import { LeadDialog } from '@/components/landing/lead-form';
import { MobileActionBar } from '@/components/landing/contact-actions';
import { Button } from '@/components/ui/button';

// 5 Senses Therapy Concept (Matching Mockup Hình 1)
const SENSES = [
  {
    icon: Leaf,
    sense: 'Khứu giác',
    detail: 'Hương thảo mộc ấm',
    desc: 'Hương thơm từ sả chanh tươi, quế chi, vỏ bưởi và hoa hồi nấu thủ công mỗi sớm mai lan tỏa dịu nhẹ, xoa dịu căng thẳng thần kinh ngay khi bạn vừa bước qua cánh cửa.',
    tag: 'Thảo mộc nấu tươi',
    image: '/sense-smell.jpg',
  },
  {
    icon: Music,
    sense: 'Thính giác',
    detail: 'Âm hưởng thiền an yên',
    desc: 'Thanh âm chuông xoay Tây Tạng kết hợp cùng âm nhạc sóng não thiền định 432Hz giúp tĩnh tâm, đưa cơ thể và não bộ chìm sâu vào trạng thái thư giãn tuyệt đối.',
    tag: 'Tần số 432Hz',
    image: '/sense-hearing.jpg',
  },
  {
    icon: Eye,
    sense: 'Thị giác',
    detail: 'Tĩnh tại & Mộc mạc',
    desc: 'Tông màu gỗ mộc trầm ấm, ánh sáng vàng 2700K dịu nhẹ cho mắt cùng những chậu cây xanh tươi mát tạo nên cảm giác bình yên như một chốn trú ẩn quen thuộc.',
    tag: 'Ánh sáng êm dịu',
    image: '/sense-sight.jpg',
  },
  {
    icon: Droplets,
    sense: 'Xúc giác',
    detail: 'Đôi tay ấm & Dầu ép lạnh',
    desc: 'Đôi bàn tay ấm nóng của kỹ thuật viên lành nghề với lực miết bấm huyệt chuẩn xác, kết hợp tinh dầu thực vật ép lạnh và khăn bông cotton hấp tiệt trùng 100°C.',
    tag: 'Dầu thực vật ép lạnh',
    image: '/sense-touch.jpg',
  },
  {
    icon: Coffee,
    sense: 'Vị giác',
    detail: 'Trà thảo mộc & Chè dưỡng nhan',
    desc: 'Tách trà hoa cúc ấm khai vị lúc mới đến để thanh lọc cơ thể, và chén chè dưỡng nhan thảo mộc thanh mát bồi bổ khí huyết sau khi kết thúc liệu trình.',
    tag: 'Thanh lọc cơ thể',
    image: '/sense-taste.jpg',
  },
];


// 4-Step Guest Experience Journey (Matching Mockup Hình 2)
const EXPERIENCE_STEPS = [
  {
    step: '01',
    icon: Users,
    title: 'Tư vấn & Lắng nghe',
    desc: 'Chuyên viên sẽ lắng nghe nhu cầu, kiểm tra tình trạng da/cơ thể và đề xuất liệu trình phù hợp nhất dành riêng cho bạn.',
    image: '/about-step-1.jpg',
  },
  {
    step: '02',
    icon: Leaf,
    title: 'Chuẩn bị liệu trình',
    desc: 'Không gian, tinh dầu, thảo mộc và dụng cụ được chuẩn bị kỹ lưỡng, đảm bảo vệ sinh và mang lại trải nghiệm trọn vẹn, an toàn cho bạn.',
    image: '/about-step-2.jpg',
  },
  {
    step: '03',
    icon: Heart,
    title: 'Trải nghiệm thư giãn',
    desc: 'Kỹ thuật viên thực hiện liệu trình với thao tác chuyên nghiệp, kết hợp tinh dầu thiên nhiên, giúp bạn thả lỏng cơ thể và cân bằng năng lượng.',
    image: '/about-step-3.jpg',
  },
  {
    step: '04',
    icon: Coffee,
    title: 'Thư giãn & Chăm sóc sau liệu trình',
    desc: 'Bạn được nghỉ ngơi, thưởng thức trà thảo mộc và nhận hướng dẫn chăm sóc tại nhà để duy trì hiệu quả lâu dài.',
    image: '/about-step-4.jpg',
  },
];

// Custom Outline Icons for Spa Spaces (Matching Mockup Hình 1)
function SpaceLeafIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6" />
    </svg>
  );
}

function SpaceLotusIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4.5c-1.8 3.2-3.4 7-3.4 10.5a3.4 3.4 0 0 0 6.8 0c0-3.5-1.6-7.3-3.4-10.5Z" />
      <path d="M8.6 15C6.2 13.5 3.8 15.2 4.2 17.8c2.2 1 5 .2 5.8-1.2" />
      <path d="M15.4 15c2.4-1.5 4.8.2 4.4 2.8-2.2 1-5 .2-5.8-1.2" />
      <path d="M5.5 19.2c2 1.3 4.2 1.3 6.5 1.3s4.5 0 6.5-1.3" />
    </svg>
  );
}

function SpaceHeartHandsIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8.8a1.9 1.9 0 0 1 2.7 0 1.9 1.9 0 0 1 0 2.7L12 14.2l-2.7-2.7a1.9 1.9 0 0 1 0-2.7 1.9 1.9 0 0 1 2.7 0Z" />
      <path d="M5 14c1.2-1 2.8-1.5 4.5-1.5.8 0 1.6.3 2.2.8" />
      <path d="M19 14c-1.2-1-2.8-1.5-4.5-1.5-.8 0-1.6.3-2.2.8" />
      <path d="M6.5 18c2 2 4 2.5 5.5 2.5s3.5-.5 5.5-2.5" />
    </svg>
  );
}

function SpaceHerbIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21c0-4.5 1-8 4-11" />
      <path d="M12 14c-3-1-5.5.5-6 3.5 2.5 1.5 5 .5 6-3.5Z" />
      <path d="M15 11c2.5-2.5 5-2 6 .5-1.5 2-4 2-6-.5Z" />
      <path d="M16 10c0-3.5 1.5-6 4-7-1 3-1 5.5 0 7" />
    </svg>
  );
}

function renderSpaceIcon(type: string) {
  switch (type) {
    case 'leaf':
      return <SpaceLeafIcon className="w-5 h-5 text-[#8D381B]" />;
    case 'lotus':
      return <SpaceLotusIcon className="w-5 h-5 text-[#8D381B]" />;
    case 'hearthands':
      return <SpaceHeartHandsIcon className="w-5 h-5 text-[#8D381B]" />;
    case 'herb':
      return <SpaceHerbIcon className="w-5 h-5 text-[#8D381B]" />;
    default:
      return <Leaf className="w-5 h-5 text-[#8D381B]" />;
  }
}

// Space Gallery (Matching Mockup Hình 1)
const SPACES = [
  {
    title: 'Không gian thư giãn tinh tế',
    desc: 'Thiết kế theo phong cách hiện đại, ấm cúng và gần gũi thiên nhiên, mang lại cảm giác bình yên ngay từ khi bạn bước vào.',
    img: '/about-space-1-new.jpg',
    iconType: 'leaf',
  },
  {
    title: 'Liệu trình cá nhân hóa',
    desc: 'Mỗi liệu trình được thiết kế riêng theo tình trạng cơ thể và nhu cầu của bạn, đảm bảo hiệu quả tối ưu và an toàn tuyệt đối.',
    img: '/about-space-2.jpg',
    iconType: 'lotus',
  },
  {
    title: 'Kỹ thuật chuyên nghiệp',
    desc: 'Đội ngũ kỹ thuật viên giàu kinh nghiệm, thành thạo các liệu pháp trị liệu hiện đại, giúp thư giãn sâu và phục hồi năng lượng tự nhiên.',
    img: '/about-space-3.jpg',
    iconType: 'hearthands',
  },
  {
    title: 'Thảo mộc thiên nhiên',
    desc: 'Sử dụng các sản phẩm từ thảo mộc thuần khiết, lành tính, an toàn cho da và tốt cho sức khỏe, mang lại trải nghiệm chăm sóc trọn vẹn.',
    img: '/about-step-4.jpg',
    iconType: 'herb',
  },
];

// Strict Organic & Hygiene Standards
const HYGIENE_STANDARDS = [
  {
    title: '100% Thảo dược tự nhiên tuyển chọn',
    desc: 'Gừng già, ngải cứu, quế chi, hoa hồi và vỏ bưởi được thu hoạch từ các vùng trồng dược liệu sạch, giữ trọn vẹn tinh chất quý giá.',
  },
  {
    title: 'Dầu thực vật ép lạnh cao cấp',
    desc: 'Sử dụng dầu Jojoba, dầu Hạnh nhân ngọt và dầu Dừa tinh khiết. Nói KHÔNG với Mineral Oil (dầu khoáng nhân tạo gây bít tắc lỗ chân lông).',
  },
  {
    title: 'Khăn bông hấp tiệt trùng 100°C',
    desc: 'Mỗi lượt khách sử dụng một bộ khăn, ga trải và áo choàng riêng biệt, được giặt sấy nhiệt độ cao và hấp tiệt trùng vô khuẩn trước khi phục vụ.',
  },
  {
    title: 'Không gian thanh lọc liên tục',
    desc: 'Máy xông tinh dầu tự nhiên hoạt động định kỳ, kết hợp lọc không khí và khử khuẩn phòng trị liệu sau mỗi buổi hẹn.',
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background pb-16 sm:pb-0">
      <SiteHeader />

      {/* Hero: Brand Story & Philosophy */}
      <section className="relative overflow-hidden bg-[#FAF5EE] pt-8 sm:pt-12 lg:pt-16 pb-24 sm:pb-32 lg:pb-36 border-b border-[#EAE0D3]/80">
        {/* Photorealistic architectural backdrop */}
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-90"
          style={{ backgroundImage: "url('/about-hero-backdrop.jpg')" }}
        />
        {/* Subtle soft gradient overlay so text is 100% crisp and legible */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#FAF5EE]/75 via-[#FAF5EE]/40 to-transparent lg:from-[#FAF5EE]/45 lg:via-transparent lg:to-transparent" />

        <div className="relative z-10 mx-auto max-w-[1360px] px-6 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-14">
            {/* Left Column: Brand Story & Values */}
            <div className="lg:col-span-6 xl:col-span-6">
              {/* Eyebrow */}
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-[#8D381B]/70" />
                <span className="text-xs sm:text-[13px] font-semibold tracking-[0.22em] text-[#8D381B] uppercase">
                  CÂU CHUYỆN THƯƠNG HIỆU · LUMIÈRE SPA
                </span>
              </div>

              {/* Main Headline */}
              <h1 className="mt-5 font-serif text-4xl sm:text-5xl lg:text-[60px] font-normal leading-[1.65] tracking-normal text-[#1F140E]">
                Nơi thời gian dừng lại,<br />
                <span className="font-serif italic font-normal text-[#8D381B]">
                  để bạn yêu thương<br />
                  chính mình.
                </span>
                <span className="inline-block ml-3 align-middle text-[#8D381B]/80">
                  <svg width="42" height="28" viewBox="0 0 42 28" fill="none" className="inline-block">
                    <path d="M2 20C12 20 20 14 28 6C32 2 37 4 39 8C41 12 37 17 30 18C22 19 16 23 22 26" stroke="#8D381B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </h1>

              {/* Story Paragraphs */}
              <div className="mt-6 space-y-4 max-w-[530px] text-[15px] sm:text-base leading-[1.75] text-[#55453B] font-light">
                <p>
                  Trong tiếng Pháp, <strong className="font-semibold text-[#1F140E]">Lumière</strong> mang ý nghĩa là <em className="italic">Ánh Sáng</em>. Chúng tôi tin rằng khi cơ thể được nghỉ ngơi sâu và tâm trí được trút bỏ muộn phiền, năng lượng tích cực và vẻ rạng ngời tự nhiên từ bên trong bạn sẽ bừng sáng.
                </p>
                <p>
                  Sinh ra từ tình yêu dành cho thảo dược truyền thống Việt Nam và mong muốn kiến tạo một không gian tĩnh lặng giữa nhịp sống đô thị, Lumière Spa là nơi bạn có thể trút bỏ mọi áp lực, thả lỏng từng thớ cơ và trao gửi thân tâm cho đôi bàn tay của những người nghệ nhân lành nghề.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/booking"
                  className="group inline-flex items-center gap-2.5 rounded-full bg-[#8D381B] px-8 py-3.5 text-sm font-semibold text-white shadow-md shadow-[#8D381B]/25 transition-all duration-300 hover:bg-[#772F16] hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                >
                  <span>Đặt lịch trải nghiệm</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/services"
                  className="inline-flex items-center justify-center rounded-full border border-[#D5C2B2] bg-[#FAF5EE]/90 px-7 py-3.5 text-sm font-semibold text-[#55453B] backdrop-blur-sm transition-all duration-300 hover:border-[#8D381B] hover:text-[#8D381B] hover:bg-white"
                >
                  Khám phá các liệu trình
                </Link>
              </div>

              {/* Bottom Stats Row */}
              <div className="mt-12 flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-6 sm:gap-2 lg:gap-4 pt-4 w-full">
                {/* Stat 1 */}
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F5ECE1] text-[#8D381B] shadow-inner">
                    <Users className="h-5 w-5" />
                  </span>
                  <div>
                    <strong className="block font-serif text-2xl font-medium text-[#1F140E] leading-none">
                      5.000+
                    </strong>
                    <span className="mt-1 block text-xs text-[#827266] font-light">
                      Khách hàng yêu quý
                    </span>
                  </div>
                </div>

                <div className="hidden h-9 w-px bg-[#E2D5C7] sm:block" />

                {/* Stat 2 */}
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F5ECE1] text-[#8D381B] shadow-inner">
                    <Star className="h-5 w-5 fill-[#8D381B] text-[#8D381B]" />
                  </span>
                  <div>
                    <div className="flex items-center gap-1 font-serif text-2xl font-medium text-[#1F140E] leading-none">
                      <span>4.9</span>
                      <span className="text-sm text-[#8D381B]">★</span>
                    </div>
                    <span className="mt-1 block text-xs text-[#827266] font-light">
                      Từ 1200+ đánh giá
                    </span>
                  </div>
                </div>

                <div className="hidden h-9 w-px bg-[#E2D5C7] sm:block" />

                {/* Stat 3 */}
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F5ECE1] text-[#8D381B] shadow-inner">
                    <Leaf className="h-5 w-5" />
                  </span>
                  <div>
                    <strong className="block font-serif text-2xl font-medium text-[#1F140E] leading-none">
                      100%
                    </strong>
                    <span className="mt-1 block text-xs text-[#827266] font-light">
                      Thảo mộc tự nhiên
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Visual Collage with Treatment Photo & Quote */}
            <div className="relative mx-auto w-full max-w-[560px] lg:col-span-6 lg:max-w-none">
              {/* Main Spa Photo Card */}
              <div className="relative aspect-[4/3] sm:aspect-[1.18] overflow-hidden rounded-[36px] sm:rounded-[44px] border border-[#E8DEC1] shadow-[0_24px_60px_rgba(35,20,12,0.14)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/about-hero-stone.jpg"
                  alt="Trị liệu đá nóng thư giãn chuyên sâu tại Lumière Spa"
                  className="h-full w-full object-cover"
                />

                {/* Elegant Arch Stamp on top-left of photo */}
                <div className="absolute left-6 top-6 rounded-[22px] border border-white/50 bg-[#1F140E]/30 p-3 sm:p-4 text-center backdrop-blur-md">
                  <div className="space-y-0.5 font-serif text-[10px] sm:text-[11px] uppercase tracking-[0.25em] text-[#FAF5EE]">
                    <p>Natural</p>
                    <p>Healing</p>
                    <p>Beauty</p>
                    <p>Within</p>
                  </div>
                  <div className="mt-1 flex justify-center text-[#E5C290]">
                    <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
                      <path d="M2 10C8 8 16 4 22 2" stroke="#E5C290" strokeWidth="1.2" strokeLinecap="round" />
                      <path d="M8 8C10 6 12 7 12 8C10 9 8 9 8 8Z" fill="#E5C290" />
                      <path d="M14 5C16 3 18 4 18 5C16 6 14 6 14 5Z" fill="#E5C290" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Floating Quote Card overlapping bottom right */}
              <div className="absolute -bottom-10 right-4 sm:-bottom-12 sm:right-6 max-w-[320px] sm:max-w-[360px] rounded-[24px] border border-[#EAE0D3] bg-[#FDFBF7]/98 p-5 sm:p-6 shadow-[0_16px_40px_rgba(40,20,10,0.12)] backdrop-blur-md">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5ECE1] text-[#8D381B]">
                  <Quote className="h-4 w-4" />
                </div>

                <p className="mt-3 font-serif text-[13px] sm:text-[15px] leading-relaxed italic text-[#20140D]">
                  &ldquo;Đến Lumière, gác lại vội vàng. Thư giãn không phải là sự xa xỉ, mà là điều cơ thể bạn xứng đáng nhận được.&rdquo;
                </p>

                <div className="mt-3.5 flex items-center justify-between border-t border-[#EFE5D8] pt-2.5">
                  <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#8D381B]">
                    ĐỘI NGŨ NGHỆ NHÂN LUMIÈRE SPA
                  </span>
                  <span className="text-[#C49A62]">
                    <Leaf className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Philosophy: Hồn Lumière trong từng chi tiết nhỏ (Matching Mockup Hình 1) */}
      <section
        className="relative overflow-hidden py-20 sm:py-24 lg:py-28 bg-[#FAF6F0] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/about-hon-bg.jpg')" }}
      >
        {/* Subtle warm wash overlay to guarantee crisp readability */}
        <div className="absolute inset-0 bg-[#FAF6F0]/25 pointer-events-none" />

        <div className="relative mx-auto max-w-[1220px] px-6">
          {/* Header */}
          <div className="mx-auto max-w-3xl text-center">
            {/* Eyebrow with gold accent rules */}
            <div className="flex items-center justify-center gap-3">
              <span className="h-[1px] w-8 sm:w-16 bg-[#B88E5B]/70" />
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.22em] text-[#8D381B]">
                HỒN LUMIÈRE · TRONG TỪNG CHI TIẾT NHỎ
              </span>
              <span className="h-[1px] w-8 sm:w-16 bg-[#B88E5B]/70" />
            </div>

            {/* Main Heading */}
            <h2 className="mt-4 font-serif text-3xl sm:text-4xl lg:text-[46px] font-normal leading-[1.4] text-[#20140D]">
              <span className="font-semibold block pb-3 sm:pb-4">Một khoảng dừng chân an yên </span>
              <span className="font-serif italic font-normal text-[#8D381B]">giữa phố thị.</span>
            </h2>

            {/* Subtext description */}
            <p className="mx-auto mt-4 max-w-2xl text-[14px] sm:text-[15.5px] leading-relaxed text-[#554238]">
              Ở Lumière Spa, chúng tôi không xem việc chăm sóc cơ thể chỉ là một dịch vụ thông thường. Đó là một nghi thức chữa lành tinh tế, nơi từng ngọn nến ấm, tách trà hoa, tấm khăn bông tiệt trùng cho đến kỹ thuật day ấn huyệt đều được chăm chút bằng tất cả tấm lòng.
            </p>
          </div>

          {/* 3 Luxury Cards */}
          <div className="mt-14 grid grid-cols-1 gap-7 md:grid-cols-3 lg:gap-8">
            {/* Card 1: Không gian tĩnh tại */}
            <div className="group relative flex flex-col rounded-[26px] bg-white border border-[#EFE5D8] shadow-[0_12px_36px_rgba(40,20,10,0.06)] overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_45px_rgba(40,20,10,0.12)]">
              {/* Card Image */}
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#F5ECE1]">
                <Image
                  src="/about-hon-space.jpg"
                  alt="Không gian tĩnh tại tại Lumière Spa"
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>

              {/* Overlapping Curved Badge Notch */}
              <div className="relative z-10 -mt-7 ml-5 inline-flex p-1.5 rounded-2xl bg-white shadow-sm self-start">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F6ECE1] text-[#8D381B]">
                  <Sparkles className="h-5 w-5" />
                </div>
              </div>

              {/* Card Content */}
              <div className="relative flex flex-1 flex-col px-6 pb-8 pt-2 sm:px-7 sm:pb-9">
                <h3 className="font-serif text-xl sm:text-2xl font-semibold text-[#20140D] tracking-normal">
                  Không gian tĩnh tại
                </h3>
                <p className="mt-3 text-[13.5px] sm:text-[14px] leading-relaxed text-[#5C4A3E]">
                  Tách biệt hoàn toàn khỏi tiếng còi xe và nhịp sống hối hả. Không gian tại Lumière Spa được thiết kế mộc mạc với ánh sáng vàng êm ái, mang lại cảm giác bình yên như bạn vừa trở về ngôi nhà của chính mình.
                </p>

                {/* Delicate botanical watermark at bottom right */}
                <svg
                  className="pointer-events-none absolute -bottom-2 -right-2 h-20 w-20 text-[#C49A62]/20 transition-transform duration-500 group-hover:scale-110"
                  viewBox="0 0 100 100"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                >
                  <path d="M90 90 C 70 80, 50 65, 35 45 C 30 38, 25 25, 20 10" />
                  <path d="M35 45 C 28 40, 18 42, 12 48 C 22 55, 30 50, 35 45 Z" fill="currentColor" fillOpacity="0.08" />
                  <path d="M50 65 C 42 62, 34 67, 30 75 C 40 78, 48 72, 50 65 Z" fill="currentColor" fillOpacity="0.08" />
                  <path d="M68 78 C 60 76, 52 82, 50 90 C 60 92, 66 86, 68 78 Z" fill="currentColor" fillOpacity="0.08" />
                </svg>
              </div>
            </div>

            {/* Card 2: Dược liệu thuần khiết */}
            <div className="group relative flex flex-col rounded-[26px] bg-white border border-[#EFE5D8] shadow-[0_12px_36px_rgba(40,20,10,0.06)] overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_45px_rgba(40,20,10,0.12)]">
              {/* Card Image */}
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#F5ECE1]">
                <Image
                  src="/about-hon-herbs.jpg"
                  alt="Dược liệu thuần khiết tại Lumière Spa"
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>

              {/* Overlapping Curved Badge Notch */}
              <div className="relative z-10 -mt-7 ml-5 inline-flex p-1.5 rounded-2xl bg-white shadow-sm self-start">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F6ECE1] text-[#8D381B]">
                  <Leaf className="h-5 w-5" />
                </div>
              </div>

              {/* Card Content */}
              <div className="relative flex flex-1 flex-col px-6 pb-8 pt-2 sm:px-7 sm:pb-9">
                <h3 className="font-serif text-xl sm:text-2xl font-semibold text-[#20140D] tracking-normal">
                  Dược liệu thuần khiết
                </h3>
                <p className="mt-3 text-[13.5px] sm:text-[14px] leading-relaxed text-[#5C4A3E]">
                  Chúng tôi tin vào sức mạnh chữa lành nguyên bản từ mẹ thiên nhiên. 100% thảo mộc được thu hái tươi mới và tinh dầu thực vật ép lạnh, không chứa hương liệu hóa học hay chất bảo quản độc hại.
                </p>

                {/* Delicate botanical watermark at bottom right */}
                <svg
                  className="pointer-events-none absolute -bottom-2 -right-2 h-20 w-20 text-[#C49A62]/20 transition-transform duration-500 group-hover:scale-110"
                  viewBox="0 0 100 100"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                >
                  <path d="M90 90 C 70 80, 50 65, 35 45 C 30 38, 25 25, 20 10" />
                  <path d="M35 45 C 28 40, 18 42, 12 48 C 22 55, 30 50, 35 45 Z" fill="currentColor" fillOpacity="0.08" />
                  <path d="M50 65 C 42 62, 34 67, 30 75 C 40 78, 48 72, 50 65 Z" fill="currentColor" fillOpacity="0.08" />
                  <path d="M68 78 C 60 76, 52 82, 50 90 C 60 92, 66 86, 68 78 Z" fill="currentColor" fillOpacity="0.08" />
                </svg>
              </div>
            </div>

            {/* Card 3: Đôi bàn tay thấu cảm */}
            <div className="group relative flex flex-col rounded-[26px] bg-white border border-[#EFE5D8] shadow-[0_12px_36px_rgba(40,20,10,0.06)] overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_45px_rgba(40,20,10,0.12)]">
              {/* Card Image */}
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#F5ECE1]">
                <Image
                  src="/about-hon-touch.jpg"
                  alt="Đôi bàn tay thấu cảm tại Lumière Spa"
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>

              {/* Overlapping Curved Badge Notch */}
              <div className="relative z-10 -mt-7 ml-5 inline-flex p-1.5 rounded-2xl bg-white shadow-sm self-start">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F6ECE1] text-[#8D381B]">
                  <Heart className="h-5 w-5" />
                </div>
              </div>

              {/* Card Content */}
              <div className="relative flex flex-1 flex-col px-6 pb-8 pt-2 sm:px-7 sm:pb-9">
                <h3 className="font-serif text-xl sm:text-2xl font-semibold text-[#20140D] tracking-normal">
                  Đôi bàn tay thấu cảm
                </h3>
                <p className="mt-3 text-[13.5px] sm:text-[14px] leading-relaxed text-[#5C4A3E]">
                  Kỹ thuật viên tại Lumière không chỉ thành thạo xoa bóp bấm huyệt Đông y mà còn phục vụ bằng sự thấu hiểu. Chúng tôi lắng nghe nhịp thở của bạn, tôn trọng sự tĩnh lặng và điều chỉnh lực ấn êm ái nhất.
                </p>

                {/* Delicate botanical watermark at bottom right */}
                <svg
                  className="pointer-events-none absolute -bottom-2 -right-2 h-20 w-20 text-[#C49A62]/20 transition-transform duration-500 group-hover:scale-110"
                  viewBox="0 0 100 100"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                >
                  <path d="M90 90 C 70 80, 50 65, 35 45 C 30 38, 25 25, 20 10" />
                  <path d="M35 45 C 28 40, 18 42, 12 48 C 22 55, 30 50, 35 45 Z" fill="currentColor" fillOpacity="0.08" />
                  <path d="M50 65 C 42 62, 34 67, 30 75 C 40 78, 48 72, 50 65 Z" fill="currentColor" fillOpacity="0.08" />
                  <path d="M68 78 C 60 76, 52 82, 50 90 C 60 92, 66 86, 68 78 Z" fill="currentColor" fillOpacity="0.08" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Signature Highlight: The 5-Senses Therapy (Matching Mockup Hình 1) */}
      <section
        className="relative overflow-hidden py-20 sm:py-24 lg:py-28 bg-[#FAF6F0] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/about-senses-backdrop.jpg')" }}
      >
        {/* Soft subtle tint overlay */}
        <div className="absolute inset-0 bg-[#FAF6F0]/20 pointer-events-none" />

        <div className="relative mx-auto max-w-[1220px] px-6">
          {/* Header */}
          <div className="mx-auto max-w-3xl text-center">
            {/* Top Lotus Icon Ornament */}
            <div className="flex justify-center text-[#C49A62]">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 3c-1.5 3-4 6-8 7 3.5 1 6.5 3.5 8 9 1.5-5.5 4.5-8 8-9-4-1-6.5-4-8-7z" />
                <path d="M12 9c-1 2-2.5 4-5 4.5 2 .8 4 2.5 5 5.5 1-3 3-4.7 5-5.5-2.5-.5-4-2.5-5-4.5z" />
              </svg>
            </div>

            {/* Eyebrow with gold accent rules */}
            <div className="mt-2.5 flex items-center justify-center gap-3">
              <span className="h-[1px] w-8 sm:w-16 bg-[#B88E5B]/70" />
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.22em] text-[#8D381B]">
                TRẢI NGHIỆM ĐỘC BẢN
              </span>
              <span className="h-[1px] w-8 sm:w-16 bg-[#B88E5B]/70" />
            </div>

            {/* Main Heading */}
            <h2 className="mt-3.5 font-serif text-3xl sm:text-4xl lg:text-[46px] font-bold leading-[1.65] text-[#20140D]">
              Hành Trình Ngũ Quan Dưỡng Sinh.
            </h2>

            {/* Small subtle floral separator icon */}
            <div className="mt-3 flex justify-center text-[#C49A62]">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 5c-1 2-3 4-6 4.5 2.5.7 4.5 2.5 6 6.5 1.5-4 3.5-5.8 6-6.5-3-.5-5-2.5-6-4.5z" />
              </svg>
            </div>

            {/* Subtext description */}
            <p className="mx-auto mt-3.5 max-w-2xl text-[14px] sm:text-[15.5px] leading-relaxed text-[#554238]">
              Khi bước qua ngưỡng cửa Lumière Spa, cả 5 giác quan của bạn sẽ được đánh thức và nâng niu một cách dịu dàng nhất.
            </p>
          </div>

          {/* Top Row: First 3 Cards (Khứu giác, Thính giác, Thị giác) */}
          <div className="mt-14 grid grid-cols-1 gap-7 md:grid-cols-3 lg:gap-8">
            {SENSES.slice(0, 3).map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="group relative flex flex-col rounded-[26px] bg-white border border-[#EFE5D8] shadow-[0_10px_30px_rgba(40,20,10,0.06)] overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_45px_rgba(40,20,10,0.12)]"
                >
                  {/* Card Image */}
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#F5ECE1]">
                    <Image
                      src={item.image}
                      alt={item.sense}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                    {/* Floating Pill Tag at Bottom-Right of Image */}
                    <div className="absolute bottom-2.5 right-3 z-10">
                      <span className="inline-flex items-center rounded-full bg-white/95 px-3 py-1 text-[11px] font-medium text-[#20140D] shadow-sm backdrop-blur-sm border border-[#EFE5D8]/80">
                        {item.tag}
                      </span>
                    </div>
                  </div>

                  {/* Overlapping Curved Badge Notch */}
                  <div className="relative z-10 -mt-7 ml-5 inline-flex p-1.5 rounded-2xl bg-white shadow-sm self-start">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F6ECE1] text-[#8D381B]">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="relative flex flex-1 flex-col px-6 pb-7 pt-2 sm:px-7 sm:pb-8">
                    <h3 className="font-serif text-lg sm:text-[19px] leading-snug tracking-normal">
                      <span className="font-semibold text-[#20140D]">{item.sense}</span>
                      <span className="text-[#C49A62] mx-1.5">·</span>
                      <span className="font-normal text-[#8D381B]">{item.detail}</span>
                    </h3>
                    <p className="mt-3 text-[13px] sm:text-[13.5px] leading-relaxed text-[#5C4A3E]">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Row: 2 Cards Centered (Xúc giác, Vị giác) */}
          <div className="mt-7 flex flex-col md:flex-row justify-center gap-7 lg:gap-8">
            {SENSES.slice(3, 5).map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="group relative flex flex-col w-full md:w-[calc((100%-2*1.75rem)/3)] rounded-[26px] bg-white border border-[#EFE5D8] shadow-[0_10px_30px_rgba(40,20,10,0.06)] overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_45px_rgba(40,20,10,0.12)]"
                >
                  {/* Card Image */}
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#F5ECE1]">
                    <Image
                      src={item.image}
                      alt={item.sense}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                    {/* Floating Pill Tag at Bottom-Right of Image */}
                    <div className="absolute bottom-2.5 right-3 z-10">
                      <span className="inline-flex items-center rounded-full bg-white/95 px-3 py-1 text-[11px] font-medium text-[#20140D] shadow-sm backdrop-blur-sm border border-[#EFE5D8]/80">
                        {item.tag}
                      </span>
                    </div>
                  </div>

                  {/* Overlapping Curved Badge Notch */}
                  <div className="relative z-10 -mt-7 ml-5 inline-flex p-1.5 rounded-2xl bg-white shadow-sm self-start">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F6ECE1] text-[#8D381B]">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="relative flex flex-1 flex-col px-6 pb-7 pt-2 sm:px-7 sm:pb-8">
                    <h3 className="font-serif text-lg sm:text-[19px] leading-snug tracking-normal">
                      <span className="font-semibold text-[#20140D]">{item.sense}</span>
                      <span className="text-[#C49A62] mx-1.5">·</span>
                      <span className="font-normal text-[#8D381B]">{item.detail}</span>
                    </h3>
                    <p className="mt-3 text-[13px] sm:text-[13.5px] leading-relaxed text-[#5C4A3E]">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Lotus Ornament */}
          <div className="mt-14 flex justify-center text-[#C49A62]">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 3c-1.5 3-4 6-8 7 3.5 1 6.5 3.5 8 9 1.5-5.5 4.5-8 8-9-4-1-6.5-4-8-7z" />
              <path d="M12 9c-1 2-2.5 4-5 4.5 2 .8 4 2.5 5 5.5 1-3 3-4.7 5-5.5-2.5-.5-4-2.5-5-4.5z" />
            </svg>
          </div>
        </div>
      </section>



      {/* 4-Step Guest Experience Journey (Matching Mockup Hình 2) */}
      <section
        className="relative overflow-hidden py-24 sm:py-28 lg:py-32 bg-[#FAF6F0] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/about-hon-bg.jpg')" }}
      >
        {/* Subtle warm wash overlay */}
        <div className="absolute inset-0 bg-[#FAF6F0]/25 pointer-events-none" />

        <div className="relative mx-auto max-w-[1240px] px-6">
          {/* Header */}
          <div className="relative mx-auto max-w-3xl text-center">
            {/* Eyebrow with gold accent rules */}
            <div className="flex items-center justify-center gap-3">
              <span className="h-[1px] w-8 sm:w-16 bg-[#B88E5B]/70" />
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.22em] text-[#8D381B]">
                QUY TRÌNH TRẢI NGHIỆM
              </span>
              <span className="h-[1px] w-8 sm:w-16 bg-[#B88E5B]/70" />
            </div>

            {/* Main Heading */}
            <h2 className="mt-4 font-serif text-3xl sm:text-4xl lg:text-[46px] font-normal leading-[1.65] text-[#20140D]">
              <span className="font-bold">Đến Lumière, </span>
              <span className="font-serif italic font-normal text-[#8D381B]">gác lại vội vàng.</span>
            </h2>

            {/* Subtext description */}
            <p className="mx-auto mt-4 max-w-2xl text-[14px] sm:text-[15.5px] leading-relaxed text-[#554238]">
              Mỗi bước trong hành trình tại Lumière được thiết kế tỉ mỉ, giúp bạn thả lỏng cơ thể và cân bằng tâm trí một cách trọn vẹn.
            </p>

            {/* Side Floating Badge (Desktop) */}
            <div className="hidden xl:flex items-center gap-3 rounded-2xl border border-[#EAE0D3] bg-white/80 px-4 py-2.5 backdrop-blur-sm shadow-sm absolute right-[-140px] top-1/2 -translate-y-1/2">
              <span className="text-[#C49A62]">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 3v18M3 12h18" strokeDasharray="2 2" />
                  <path d="M12 7c-2 2-3 4-3 5s1 3 3 5c2-2 3-4 3-5s-1-3-3-5z" />
                </svg>
              </span>
              <div className="text-left text-[11px] leading-tight text-[#8D381B] font-serif">
                <p className="font-medium">Hành trình nhỏ</p>
                <p className="italic text-[#5C4A3E]">cho một phiên bản</p>
                <p className="font-medium">rạng rỡ hơn</p>
              </div>
            </div>
          </div>

          {/* Connected Steps Grid */}
          <div className="relative mt-14">
            {/* Graceful Connecting Flowing Line across the 4 steps (Desktop) */}
            <svg
              className="hidden lg:block absolute top-[48%] left-0 right-0 w-full h-16 pointer-events-none z-0"
              viewBox="0 0 1200 60"
              fill="none"
              preserveAspectRatio="none"
            >
              <path
                d="M 150 30 C 240 65, 330 0, 420 30 C 510 65, 600 0, 690 30 C 780 65, 870 0, 960 30 C 1020 45, 1080 30, 1120 30"
                stroke="#C49A62"
                strokeWidth="1.5"
                strokeOpacity="0.4"
              />
            </svg>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {EXPERIENCE_STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.step}
                    className="group relative flex flex-col rounded-[26px] bg-white border border-[#EFE5D8] shadow-[0_10px_30px_rgba(40,20,10,0.06)] overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_45px_rgba(40,20,10,0.12)] z-10"
                  >
                    {/* Step Card Photo */}
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#F5ECE1]">
                      <Image
                        src={step.image}
                        alt={step.title}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, 25vw"
                      />
                    </div>

                    {/* Overlapping Curved Badge Notch */}
                    <div className="relative z-10 -mt-7 ml-5 inline-flex p-1.5 rounded-2xl bg-white shadow-sm self-start">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F6ECE1] text-[#8D381B]">
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>

                    {/* Step Content */}
                    <div className="relative flex flex-1 flex-col px-5 pb-7 pt-2 sm:px-6 sm:pb-8">
                      {/* Step Number + Title */}
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center rounded-md bg-[#F6ECE1] px-2 py-0.5 text-xs font-bold font-serif text-[#8D381B]">
                          {step.step}
                        </span>
                        <h3 className="font-serif text-[16.5px] font-semibold text-[#20140D] tracking-normal">
                          {step.title}
                        </h3>
                      </div>

                      {/* Description */}
                      <p className="mt-3 text-[12.5px] sm:text-[13px] leading-relaxed text-[#5C4A3E]">
                        {step.desc}
                      </p>

                      {/* Delicate botanical watermark at bottom right */}
                      <svg
                        className="pointer-events-none absolute -bottom-2 -right-2 h-16 w-16 text-[#C49A62]/20 transition-transform duration-500 group-hover:scale-110"
                        viewBox="0 0 100 100"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.2"
                      >
                        <path d="M90 90 C 70 80, 50 65, 35 45 C 30 38, 25 25, 20 10" />
                        <path d="M35 45 C 28 40, 18 42, 12 48 C 22 55, 30 50, 35 45 Z" fill="currentColor" fillOpacity="0.08" />
                        <path d="M50 65 C 42 62, 34 67, 30 75 C 40 78, 48 72, 50 65 Z" fill="currentColor" fillOpacity="0.08" />
                        <path d="M68 78 C 60 76, 52 82, 50 90 C 60 92, 66 86, 68 78 Z" fill="currentColor" fillOpacity="0.08" />
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Strict Organic & Hygiene Standards */}
      <section className="py-20 lg:py-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <span className="eyebrow">Tiêu chuẩn chuẩn mực</span>
              <h2 className="section-heading mt-3">Nguyên liệu thuần khiết &amp; Vô trùng y tế.</h2>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
                Sức khỏe và làn da của khách hàng là ưu tiên cao nhất. Mọi giọt tinh dầu tiếp xúc với cơ thể bạn hay từng tấm khăn đều phải đáp ứng những tiêu chuẩn vệ sinh nghiêm ngặt nhất.
              </p>

              <div className="mt-8 space-y-5">
                {HYGIENE_STANDARDS.map((std, idx) => (
                  <div key={idx} className="flex gap-4">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-1">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <div>
                      <h4 className="font-semibold text-sm sm:text-base text-foreground">{std.title}</h4>
                      <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">{std.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-border shadow-xl sm:aspect-[4/3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=900&auto=format&fit=crop&q=80"
                  alt="Chuẩn mực nguyên liệu thảo mộc tại Lumière Spa"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />
                <div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-white/95 p-4 backdrop-blur-md dark:bg-black/85">
                  <p className="font-serif text-lg font-medium text-foreground">
                    An toàn tuyệt đối cho mọi làn da nhạy cảm
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    100% tinh dầu thực vật ép lạnh · Không dầu khoáng (Mineral oil)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Spa Spaces Gallery (Matching Mockup Hình 1) */}
      <section className="relative overflow-hidden bg-[#FAF7F2] py-20 lg:py-24 border-t border-[#F0E6D8]">
        {/* Delicate background wash & sketch */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-25 pointer-events-none"
          style={{ backgroundImage: "url('/about-hon-bg.jpg')" }}
        />

        {/* Left Botanical Flourish */}
        <div className="absolute -left-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 lg:opacity-75 hidden md:block">
          <svg width="220" height="420" viewBox="0 0 220 420" fill="none" stroke="#CBB49C" strokeWidth="1.2">
            <circle cx="85" cy="110" r="8" fill="#E8D7C5" stroke="none" />
            <path d="M-20 280 C60 260 120 180 85 110 C60 60 10 20 -30 10" />
            <path d="M85 110 C130 90 180 130 160 180 C140 220 90 200 80 170" />
            <path d="M40 220 C90 220 110 270 80 300 C50 330 20 300 30 260" />
            <path d="M85 110 Q 115 80 125 105 Q 105 125 85 110 Z" fill="#F4EBE0" fillOpacity="0.4" />
            <path d="M60 160 Q 80 130 100 150 Q 85 175 60 160 Z" fill="#F4EBE0" fillOpacity="0.4" />
            <path d="M45 230 Q 75 210 85 235 Q 65 255 45 230 Z" fill="#F4EBE0" fillOpacity="0.4" />
          </svg>
        </div>

        {/* Right Botanical Flourish */}
        <div className="absolute -right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 lg:opacity-75 hidden md:block">
          <svg width="220" height="420" viewBox="0 0 220 420" fill="none" stroke="#CBB49C" strokeWidth="1.2">
            <path d="M240 80 C160 120 100 200 135 290 C160 350 210 390 250 400" />
            <path d="M135 290 C90 310 40 270 60 220 C80 180 130 200 140 230" />
            <path d="M180 180 C130 180 110 130 140 100 C170 70 200 100 190 140" />
            <path d="M135 290 Q 105 320 95 295 Q 115 275 135 290 Z" fill="#F4EBE0" fillOpacity="0.4" />
            <path d="M160 240 Q 140 270 120 250 Q 135 225 160 240 Z" fill="#F4EBE0" fillOpacity="0.4" />
            <path d="M175 170 Q 145 190 135 165 Q 155 145 175 170 Z" fill="#F4EBE0" fillOpacity="0.4" />
          </svg>
        </div>

        <div className="relative z-10 mx-auto max-w-[1240px] px-6">
          {/* Header Row: Dual Title on Left, Description + Link on Right */}
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-12 lg:mb-14">
            <div>
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.22em] text-[#9B3E1F]">
                KHÔNG GIAN LUMIÈRE SPA
              </span>
              <h2 className="mt-2.5 font-serif text-3xl sm:text-4xl lg:text-[42px] leading-tight">
                <span className="italic font-normal text-[#8D381B]">Chốn tĩnh lặng</span>{' '}
                <span className="font-bold text-[#20140D]">giữa lòng đô thị.</span>
              </h2>
            </div>

            <div className="max-w-[440px] lg:text-left">
              <p className="text-xs sm:text-[13px] leading-relaxed text-[#6B5E55]">
                Lumière Spa mang đến những dịch vụ chăm sóc toàn diện, giúp bạn cân bằng thân - tâm - trí và tìm lại nguồn năng lượng tích cực trong cuộc sống bận rộn.
              </p>
              <Link
                href="/services"
                className="mt-2.5 inline-flex items-center gap-1.5 text-xs sm:text-[13px] font-semibold text-[#8D381B] hover:text-[#6e2912] transition-colors group"
              >
                <span>Khám phá không gian của chúng tôi</span>
                <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
              </Link>
            </div>
          </div>

          {/* 4 Cards Grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {SPACES.map((space, i) => (
              <div
                key={i}
                className="group flex flex-col rounded-[26px] sm:rounded-[28px] bg-white p-2.5 pb-6 sm:pb-7 border border-[#EFE5D8] shadow-[0_8px_30px_rgba(40,20,10,0.04)] hover:shadow-[0_16px_36px_rgba(40,20,10,0.09)] hover:-translate-y-1 transition-all duration-300"
              >
                {/* Image Container with Organic Wave Silhouette at bottom */}
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[20px] bg-[#F5ECE1]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={space.img}
                    alt={space.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  {/* Organic bottom wave shape */}
                  <svg
                    className="absolute -bottom-[1px] left-0 w-full h-8 text-white fill-current pointer-events-none"
                    viewBox="0 0 240 32"
                    preserveAspectRatio="none"
                  >
                    <path d="M0,16 C40,28 75,6 125,18 C175,30 205,10 240,14 L240,32 L0,32 Z" />
                  </svg>
                </div>

                {/* Overlapping Icon Badge */}
                <div className="relative z-10 -mt-5 ml-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E8DACB] bg-[#FFF8F0] shadow-sm">
                  {renderSpaceIcon(space.iconType)}
                </div>

                {/* Card Content */}
                <div className="flex flex-1 flex-col px-4 pt-3">
                  <div className="flex items-start justify-between gap-2.5">
                    <h3 className="font-sans text-[15px] sm:text-[16px] font-bold leading-snug text-[#1F1713] transition-colors group-hover:text-[#8D381B]">
                      {space.title}
                    </h3>
                    <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-[#F5ECE1] text-[#3A2218] shadow-sm transition-all group-hover:bg-[#8D381B] group-hover:text-white">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <p className="mt-3 text-xs sm:text-[12.5px] leading-relaxed text-[#706359]">
                    {space.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action Banner (Matching Mockup Hình 1) */}
      <section
        className="relative overflow-hidden py-20 sm:py-24 lg:py-28 bg-[#FAF6F0] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/about-hon-bg.jpg')" }}
      >
        {/* Subtle warm wash */}
        <div className="absolute inset-0 bg-[#FAF6F0]/25 pointer-events-none" />

        <div className="relative mx-auto max-w-[1240px] px-6">
          <div className="relative overflow-hidden rounded-[32px] sm:rounded-[36px] bg-[#FAF5EE] border border-[#EFE5D8] shadow-[0_20px_60px_rgba(40,20,10,0.08)]">
            <div className="grid grid-cols-1 items-stretch lg:grid-cols-12">
              {/* Left Column: Content */}
              <div className="relative z-10 flex flex-col justify-center p-8 sm:p-12 lg:col-span-7 lg:py-14 lg:pl-14 lg:pr-8">
                {/* Eyebrow */}
                <div className="flex items-center gap-2.5 text-[#8D381B]">
                  <Sparkles className="h-4 w-4 text-[#C49A62]" />
                  <span className="h-[1px] w-6 bg-[#C49A62]/60" />
                  <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.22em]">
                    LUMIÈRE SPA
                  </span>
                </div>

                {/* Main Heading */}
                <h2 className="mt-4 font-serif text-3xl sm:text-4xl lg:text-[44px] font-normal leading-[1.65] text-[#20140D]">
                  <span className="font-bold block pb-2 sm:pb-3">Hôm nay, hãy để</span>
                  <span className="font-bold">
                    <span className="text-[#8D381B]">Lumière</span> chăm sóc bạn.
                  </span>
                </h2>

                {/* Subtext description with highlight badge */}
                <p className="mt-4 max-w-lg text-[13.5px] sm:text-[14.5px] leading-relaxed text-[#554238]">
                  Đặt lịch online ngay để tận hưởng ưu đãi{' '}
                  <span className="inline-block rounded-md bg-[#F6ECE1] px-2 py-0.5 font-bold text-[#8D381B]">
                    giảm 10%
                  </span>{' '}
                  cho lần trải nghiệm đầu tiên. Lịch hẹn được xác nhận tức thì, không cần thanh toán trước.
                </p>

                {/* Action Buttons */}
                <div className="mt-7 flex flex-wrap items-center gap-4">
                  <Link
                    href="/booking"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#8D381B] px-7 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(141,56,27,0.25)] transition-all hover:bg-[#722C14] hover:shadow-[0_12px_24px_rgba(141,56,27,0.35)]"
                  >
                    Đặt lịch hẹn ngay <ArrowRight className="h-4 w-4" />
                  </Link>

                  <LeadDialog source="about_cta" interest="Tư vấn trải nghiệm">
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-12 rounded-xl border-[#E2D4C3] bg-[#F5ECE1]/70 px-7 text-sm font-semibold text-[#8D381B] hover:bg-[#F5ECE1] hover:border-[#D5C2AD]"
                    >
                      Để lại SĐT tư vấn
                    </Button>
                  </LeadDialog>
                </div>

                {/* Bottom Divider & Contact/Hours Meta */}
                <div className="mt-8 border-t border-[#EFE5D8] pt-6 flex flex-wrap items-center gap-6 sm:gap-10">
                  {/* Hotline */}
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5ECE1] text-[#8D381B]">
                      <Phone className="h-4 w-4" />
                    </span>
                    <div className="text-left text-xs text-[#7A6658]">
                      <p>Hotline hỗ trợ</p>
                      <a
                        href={telHref(SITE.phone)}
                        className="text-sm sm:text-base font-bold text-[#20140D] hover:text-[#8D381B] transition-colors"
                      >
                        {SITE.phone}
                      </a>
                    </div>
                  </div>

                  {/* Hours */}
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5ECE1] text-[#8D381B]">
                      <Clock className="h-4 w-4" />
                    </span>
                    <div className="text-left text-xs text-[#7A6658]">
                      <p>Mở cửa</p>
                      <p className="text-xs sm:text-sm font-medium text-[#20140D]">
                        {SITE.hours}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Organic Arch Spa Photography */}
              <div className="relative min-h-[320px] sm:min-h-[400px] lg:col-span-5 lg:min-h-full overflow-hidden">
                {/* Organic Parabolic Arch Cut-out Wrapper */}
                <div className="relative h-full w-full lg:rounded-l-[160px] overflow-hidden shadow-inner bg-[#F5ECE1]">
                  <Image
                    src="/about-cta-spa.jpg"
                    alt="Lumière Spa Sanctuary"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 42vw"
                  />
                  {/* Soft subtle warm gradient overlay on image */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
                </div>

                {/* Botanical Blooming Rose/Lotus Sketch Overlay at the Curve */}
                <svg
                  className="pointer-events-none absolute bottom-0 left-[-20px] z-20 hidden lg:block h-44 w-44 text-[#C49A62]/45"
                  viewBox="0 0 160 160"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                >
                  <path d="M40 140 C 50 110, 70 90, 90 70 C 100 60, 115 50, 130 45" />
                  <path d="M90 70 C 75 60, 60 65, 55 75 C 65 85, 80 80, 90 70 Z" fill="currentColor" fillOpacity="0.06" />
                  <path d="M105 85 C 95 95, 95 110, 105 120 C 115 110, 115 95, 105 85 Z" fill="currentColor" fillOpacity="0.06" />
                  <path d="M130 45 C 120 30, 105 32, 95 42 C 100 55, 115 52, 130 45 Z" fill="currentColor" fillOpacity="0.08" />
                  <path d="M130 45 C 145 35, 155 45, 150 58 C 138 60, 132 50, 130 45 Z" fill="currentColor" fillOpacity="0.08" />
                  <path d="M115 25 C 125 15, 140 20, 142 32 C 132 36, 122 30, 115 25 Z" fill="currentColor" fillOpacity="0.08" />
                </svg>
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
