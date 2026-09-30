'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Flower2,
  Gift,
  Heart,
  Leaf,
  MapPin,
  MessageCircle,
  Navigation,
  Percent,
  Phone,
  PhoneCall,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { SITE, telHref } from '@/lib/site-config';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { LeadForm } from '@/components/landing/lead-form';
import { MobileActionBar } from '@/components/landing/contact-actions';
import { Button } from '@/components/ui/button';

const PROMOTIONS = [
  {
    id: 'first-visit',
    badge: 'DÀNH CHO KHÁCH HÀNG MỚI',
    title: 'Ưu Đãi Trải Nghiệm Lần Đầu',
    discount: 'GIẢM 10%',
    subtitle: 'Áp dụng cho mọi liệu trình đơn lẻ hoặc combo tại Lumière Spa',
    desc: 'Lần đầu ghé thăm Lumière Spa, bạn được giảm trực tiếp 10% trên hóa đơn dịch vụ bất kỳ cùng một set trà thảo mộc & ngâm chân muối khoáng chào đón hoàn toàn miễn phí.',
    code: 'LUMIERE10',
    validUntil: 'Áp dụng đến hết tháng này',
    image: '/offer-first-visit.jpg',
    highlights: [
      'Áp dụng cho tất cả dịch vụ trong thực đơn',
      'Tặng kèm 15 phút ngâm chân thảo mộc & thưởng trà hoa',
      'Được chọn kỹ thuật viên theo yêu cầu',
      'Không phụ thu cuối tuần hay ngày lễ',
    ],
    ctaText: 'Đặt lịch nhận ưu đãi ngay',
    href: '/booking?promo=LUMIERE10',
  },
  {
    id: 'vip-member',
    badge: 'GÓI HỘI VIÊN TIẾT KIỆM',
    title: 'Thẻ Hội Viên VIP Thư Thái',
    discount: 'TIẾT KIỆM 25%',
    subtitle: 'Gói 10 buổi trị liệu chuyên sâu không giới hạn thời gian sử dụng',
    desc: 'Thiết kế riêng cho khách hàng duy trì thói quen chăm sóc sức khỏe và làn da định kỳ. Tiết kiệm chi phí vượt trội và nhận nhiều đặc quyền phòng VIP độc quyền.',
    code: 'VIPCARE25',
    validUntil: 'Số lượng phát hành có hạn',
    image: '/offer-member-card.jpg',
    highlights: [
      'Tiết kiệm đến 25% so với giá dịch vụ lẻ từng buổi',
      'Đặc quyền sử dụng phòng đôi VIP riêng tư miễn phí',
      'Tặng 1 chai tinh dầu trị liệu nguyên chất trị giá 450.000 đ',
      'Có thể chia sẻ số buổi cho người thân hoặc bạn bè',
    ],
    ctaText: 'Đăng ký thẻ hội viên',
    href: '/booking',
  },
  {
    id: 'gift-voucher',
    badge: 'MÓN QUÀ TINH TẾ',
    title: 'Thẻ Quà Tặng Thư Giãn (Gift Card)',
    discount: 'TẶNG THIỆP & HỘP',
    subtitle: 'Trao gửi bình yên và sự chăm sóc ân cần đến người bạn yêu thương',
    desc: 'Món quà hoàn hảo dành tặng mẹ, vợ, người yêu, đồng nghiệp hoặc đối tác trong các dịp sinh nhật, kỷ niệm. Hộp quà thắt nơ lụa cao cấp kèm thiệp chúc mừng viết tay theo yêu cầu.',
    code: 'SPAGIFT',
    validUntil: 'Thời hạn sử dụng 06 tháng',
    image: '/offer-gift-card.jpg',
    highlights: [
      'Tùy chọn mệnh giá linh hoạt từ 500.000 đ đến 3.000.000 đ',
      'Hộp quà giấy mỹ thuật thắt nơ lụa cao cấp miễn phí',
      'Hỗ trợ gửi thiệp viết tay tận nơi cho người nhận',
      'Áp dụng cho mọi liệu trình chăm sóc và combo',
    ],
    ctaText: 'Tư vấn đặt thẻ quà tặng',
    href: '#lead-form-section',
  },
  {
    id: 'couple-relax',
    badge: 'GẮN KẾT YÊU THƯƠNG',
    title: 'Combo Cặp Đôi & Mẹ Con',
    discount: 'GIẢM 20%',
    subtitle: 'Không gian riêng tư 90 phút cho 2 người cùng nến thơm và hoa tươi',
    desc: 'Khoảng thời gian tuyệt vời để cùng người thân yêu buông bỏ lo toan, cùng nhau trò chuyện và tái tạo năng lượng với liệu pháp massage body tinh dầu ấm kết hợp gội đầu dưỡng sinh.',
    code: 'COUPLE20',
    validUntil: 'Cần đặt trước tối thiểu 2 giờ',
    image: '/about-space-3.jpg',
    highlights: [
      'Phòng đôi VIP riêng tư, bài trí nến thơm và hoa sứ lãng mạn',
      'Liệu trình trọn gói 90 phút kết hợp Body & Gội đầu thảo mộc',
      'Thưởng thức trà dưỡng nhan và bánh sen ấm nóng sau liệu trình',
      'Giảm 20% tổng hóa đơn khi đặt lịch cùng nhau',
    ],
    ctaText: 'Đặt lịch phòng đôi',
    href: '/booking',
  },
];

const TRUST_POINTS = [
  {
    step: '01',
    title: 'Cam kết minh bạch',
    desc: 'Giá niêm yết rõ ràng, không phát sinh bất kỳ khoản phụ phí hay chi phí ẩn nào.',
    image: '/trust-1-transparency.jpg',
  },
  {
    step: '02',
    title: 'Bảo lưu linh hoạt',
    desc: 'Khách hàng có việc bận đột xuất có thể bảo lưu hoặc đổi giờ hẹn hợp lý, hoàn toàn miễn phí.',
    image: '/trust-2-flexibility.jpg',
  },
  {
    step: '03',
    title: '100% Thảo mộc tự nhiên',
    desc: 'Toàn bộ tinh dầu thực vật ép lạnh và nguyên liệu chọn lọc, đảm bảo an toàn tuyệt đối, mang lại cảm giác thư giãn thuần khiết.',
    image: '/trust-3-organic.jpg',
  },
  {
    step: '04',
    title: 'Dịch vụ tận tâm',
    desc: 'Đội ngũ kỹ thuật viên tay nghề vững, được đào tạo bài bản với thái độ phục vụ ân cần và chu đáo.',
    image: '/trust-4-dedication.jpg',
  },
];

export default function OffersPage() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Đã sao chép mã ưu đãi: ${code}`, {
      description: 'Nhập mã này tại bước thanh toán hoặc đọc cho lễ tân khi đến spa.',
    });
    setTimeout(() => setCopiedCode(null), 3000);
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] pb-16 sm:pb-0">
      <SiteHeader />

      {/* Hero Header (Matching Mockup Hình 1) */}
      <section className="relative overflow-hidden border-b border-[#EFE5D8] bg-[#FAF6F0] py-12 sm:py-16 lg:py-20">
        {/* Left Botanical Flourish (Matching Hình 1) */}
        <div className="pointer-events-none absolute -left-4 top-1/2 -translate-y-1/2 opacity-40 lg:opacity-75 hidden md:block">
          <svg width="220" height="420" viewBox="0 0 220 420" fill="none" stroke="#CBB49C" strokeWidth="1.2">
            <path d="M-20 280 C60 260 120 180 85 110 C60 60 10 20 -30 10" />
            <path d="M85 110 C130 90 180 130 160 180 C140 220 90 200 80 170" />
            <path d="M40 220 C90 220 110 270 80 300 C50 330 20 300 30 260" />
            <path d="M85 110 Q 115 80 125 105 Q 105 125 85 110 Z" fill="#F4EBE0" fillOpacity="0.4" />
            <path d="M60 160 Q 80 130 100 150 Q 85 175 60 160 Z" fill="#F4EBE0" fillOpacity="0.4" />
            <path d="M45 230 Q 75 210 85 235 Q 65 255 45 230 Z" fill="#F4EBE0" fillOpacity="0.4" />
          </svg>
        </div>

        <div className="relative z-10 mx-auto max-w-[1240px] px-6">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
            {/* Left Content Column */}
            <div className="lg:col-span-6">
              {/* Eyebrow Pill Tag */}
              <div className="inline-flex items-center gap-2 rounded-full border border-[#D8C7B5] bg-white/80 backdrop-blur-sm px-3.5 py-1 text-xs font-semibold text-[#8D381B] shadow-sm mb-2">
                <Tag className="h-3.5 w-3.5 text-[#8D381B]" />
                <span>ƯU ĐÃI ĐỘC QUYỀN · LUMIÈRE SPA</span>
              </div>

              {/* Main Heading with Dual Typography */}
              <h1 className="mt-3.5 font-serif text-3xl sm:text-4xl lg:text-[50px] font-normal leading-[1.65] text-[#20140D]">
                <span className="font-bold">Ưu đãi tinh tế</span>
                <br />
                <span className="italic text-[#8D381B]">dành riêng cho bạn.</span>
              </h1>

              {/* Subtitle description */}
              <p className="mt-4 max-w-lg text-xs sm:text-[13.5px] lg:text-[14px] leading-relaxed text-[#6B5E55]">
                Khám phá quà tặng thư giãn, chương trình khách mới và quyền lợi thành viên để mỗi lần ghé thăm đều trọn vẹn hơn.
              </p>

              {/* CTA Action Buttons */}
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href="#promotions-list"
                  className="inline-flex items-center gap-2 rounded-full bg-[#8D381B] px-6 py-3 text-xs sm:text-sm font-semibold text-white shadow-[0_4px_16px_rgba(141,56,27,0.22)] hover:bg-[#722A13] hover:shadow-[0_6px_20px_rgba(141,56,27,0.32)] transition-all"
                >
                  <span>Xem ưu đãi ngay</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  href="#lead-form-section"
                  className="inline-flex items-center gap-2 rounded-full border border-[#D8C7B5] bg-[#FAF5EE]/90 backdrop-blur-sm px-6 py-3 text-xs sm:text-sm font-semibold text-[#554238] hover:bg-white hover:text-[#20140D] hover:border-[#8D381B]/40 shadow-sm transition-all"
                >
                  <span>Mua thẻ quà tặng</span>
                  <span className="text-sm">🎁</span>
                </Link>
              </div>

              {/* Bottom 3 Benefits Strip with Dividers (Matching Hình 1) */}
              <div className="mt-8 pt-6 border-t border-[#E8DACB]/80 flex flex-wrap items-center gap-5 sm:gap-7">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F3ECE1] text-[#8D381B] text-xs font-bold shadow-sm">
                    %
                  </span>
                  <span className="text-xs sm:text-[13px] font-medium text-[#4F3E34]">
                    Giảm 10% lần đầu
                  </span>
                </div>

                <span className="hidden sm:block h-3.5 w-[1px] bg-[#D9C8B5]" />

                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F3ECE1] text-[#8D381B] text-xs font-bold shadow-sm">
                    🎁
                  </span>
                  <span className="text-xs sm:text-[13px] font-medium text-[#4F3E34]">
                    Tặng thiệp &amp; hộp quà
                  </span>
                </div>

                <span className="hidden sm:block h-3.5 w-[1px] bg-[#D9C8B5]" />

                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F3ECE1] text-[#8D381B] text-xs font-bold shadow-sm">
                    👑
                  </span>
                  <span className="text-xs sm:text-[13px] font-medium text-[#4F3E34]">
                    Ưu đãi thành viên
                  </span>
                </div>
              </div>
            </div>

            {/* Right Photo Artwork Column (Matching Hình 1) */}
            <div className="relative lg:col-span-6 block">
              <div className="relative overflow-hidden rounded-[26px] sm:rounded-[30px] border border-[#EFE5D8] shadow-[0_16px_48px_rgba(40,20,10,0.08)] bg-[#FAF5EE]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/offers-hero-photo.png"
                  alt="Ưu đãi tinh tế Lumière Spa"
                  className="h-auto w-full object-cover transition-transform duration-700 hover:scale-[1.02]"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Promotions Grid */}
      <section id="promotions-list" className="mx-auto max-w-[1240px] px-6 py-12 lg:py-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.22em] text-[#9B3E1F]">
            CHƯƠNG TRÌNH ĐANG DIỄN RA
          </span>
          <h2 className="mt-2 font-serif text-2xl sm:text-3xl lg:text-4xl font-normal text-[#20140D]">
            Chọn ưu đãi phù hợp với <span className="italic font-medium text-[#8D381B]">nhu cầu của bạn</span>
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-[#6B5E55]">
            Mọi ưu đãi đều được áp dụng trực tiếp khi đặt lịch online hoặc xuất trình mã ưu đãi tại quầy lễ tân.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
          {PROMOTIONS.map((promo) => (
            <div
              key={promo.id}
              className="group flex flex-col rounded-[28px] bg-white border border-[#EFE5D8] overflow-hidden shadow-[0_8px_30px_rgba(40,20,10,0.04)] hover:shadow-[0_18px_48px_rgba(40,20,10,0.09)] hover:-translate-y-1 transition-all duration-300"
            >
              {/* Promo Image Container */}
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#F5ECE1]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={promo.image}
                  alt={promo.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />

                {/* Badge top-left */}
                <span className="absolute top-4 left-4 rounded-full bg-[#8D381B] px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-md">
                  {promo.badge}
                </span>

                {/* Discount Tag top-right */}
                <span className="absolute top-4 right-4 rounded-full bg-white/95 backdrop-blur-md px-3.5 py-1 text-xs font-bold text-[#8D381B] shadow-md">
                  {promo.discount}
                </span>

                {/* Bottom title on image */}
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-xs text-white/80">{promo.subtitle}</p>
                </div>
              </div>

              {/* Card Body */}
              <div className="flex flex-1 flex-col p-6 sm:p-7">
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#20140D] group-hover:text-[#8D381B] transition-colors leading-snug">
                  {promo.title}
                </h3>
                <p className="mt-2.5 text-xs sm:text-[13px] leading-relaxed text-[#6B5E55]">
                  {promo.desc}
                </p>

                {/* Feature Highlights */}
                <ul className="mt-4 space-y-2 border-t border-[#F2EAE0] pt-4 text-xs sm:text-[13px] text-[#4F3E34]">
                  {promo.highlights.map((h, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#8D381B] mt-0.5" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>

                {/* Coupon Code Strip */}
                <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl bg-[#FAF5EE] p-3 border border-[#EFE5D8]">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9B3E1F] block">
                      Mã ưu đãi
                    </span>
                    <span className="font-mono text-sm sm:text-base font-bold text-[#20140D]">
                      {promo.code}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyCode(promo.code)}
                    className="h-9 gap-1.5 rounded-xl border-[#D8C7B5] bg-white px-3 text-xs font-semibold text-[#8D381B] hover:bg-[#FAF4EC]"
                  >
                    {copiedCode === promo.code ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-green-600" />
                        <span className="text-green-600">Đã sao chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Sao chép mã</span>
                      </>
                    )}
                  </Button>
                </div>

                {/* Footer Action */}
                <div className="mt-6 pt-4 border-t border-[#F2EAE0] flex items-center justify-between gap-3">
                  <span className="text-[11px] text-[#8C7A6D]">{promo.validUntil}</span>
                  <Link
                    href={promo.href}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#8D381B] px-5 py-2.5 text-xs sm:text-[13px] font-semibold text-white shadow-sm hover:bg-[#722A13] transition-colors"
                  >
                    <span>{promo.ctaText}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Trust & Guarantee Section (Matching Mockup Hình 1) */}
      <section className="relative overflow-hidden border-y border-[#EFE5D8] bg-[#FAF6F0] pt-14 sm:pt-16 lg:pt-20 pb-0">
        {/* Top-Left Botanical Sketch */}
        <div className="pointer-events-none absolute -left-4 top-8 opacity-40 lg:opacity-75 hidden md:block">
          <svg width="220" height="320" viewBox="0 0 220 320" fill="none" stroke="#CBB49C" strokeWidth="1.2">
            <path d="M-20 200 C50 180 100 120 70 60 C50 20 10 10 -20 5" />
            <path d="M70 60 C110 45 150 80 135 120 C120 155 80 140 70 115" />
            <path d="M70 60 Q 95 35 105 55 Q 85 75 70 60 Z" fill="#F4EBE0" fillOpacity="0.4" />
            <path d="M50 100 Q 70 75 85 90 Q 70 115 50 100 Z" fill="#F4EBE0" fillOpacity="0.4" />
          </svg>
        </div>

        {/* Top-Right Botanical Sketch */}
        <div className="pointer-events-none absolute -right-4 top-8 opacity-40 lg:opacity-75 hidden md:block">
          <svg width="220" height="320" viewBox="0 0 220 320" fill="none" stroke="#CBB49C" strokeWidth="1.2">
            <path d="M240 200 C170 180 120 120 150 60 C170 20 210 10 240 5" />
            <path d="M150 60 C110 45 70 80 85 120 C100 155 140 140 150 115" />
            <path d="M150 60 Q 125 35 115 55 Q 135 75 150 60 Z" fill="#F4EBE0" fillOpacity="0.4" />
            <path d="M170 100 Q 150 75 135 90 Q 150 115 170 100 Z" fill="#F4EBE0" fillOpacity="0.4" />
          </svg>
        </div>

        <div className="relative z-10 mx-auto max-w-[1240px] px-6">
          {/* Header Row */}
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
            <div className="flex items-center justify-center gap-3 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.24em] text-[#9B3E1F]">
              <span className="h-[1px] w-8 bg-[#D8C7B5]" />
              <span>YÊN TÂM TRẢI NGHIỆM</span>
              <span className="h-[1px] w-8 bg-[#D8C7B5]" />
            </div>

            <h2 className="mt-3 font-serif text-3xl sm:text-4xl lg:text-[44px] font-normal text-[#20140D] text-center leading-tight">
              <span className="font-bold">Cam kết dịch vụ tại</span>{' '}
              <span className="italic font-normal text-[#8D381B]">Lumière Spa</span>
            </h2>

            {/* Lotus Ornament */}
            <div className="flex justify-center mt-3 mb-3.5 text-[#C49A62]">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 4.5c-1.8 3.2-3.4 7-3.4 10.5a3.4 3.4 0 0 0 6.8 0c0-3.5-1.6-7.3-3.4-10.5Z" />
                <path d="M8.6 15C6.2 13.5 3.8 15.2 4.2 17.8c2.2 1 5 .2 5.8-1.2" />
                <path d="M15.4 15c2.4-1.5 4.8.2 4.4 2.8-2.2 1-5 .2-5.8-1.2" />
                <path d="M5.5 19.2c2 1.3 4.2 1.3 6.5 1.3s4.5 0 6.5-1.3" />
              </svg>
            </div>

            <p className="max-w-2xl mx-auto text-xs sm:text-[13.5px] leading-relaxed text-[#6B5E55] text-center">
              Chúng tôi tin rằng mỗi trải nghiệm thư giãn đều xứng đáng với sự an tâm tuyệt đối.<br className="hidden sm:inline" />
              Lumière Spa cam kết mang đến dịch vụ tinh tế, minh bạch và luôn đặt lợi ích của bạn lên hàng đầu.
            </p>
          </div>

          {/* 4 Luxury Cards Grid (Matching Hình 1) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-7">
            {TRUST_POINTS.map((item, i) => (
              <div
                key={i}
                className="group relative flex flex-col rounded-[26px] sm:rounded-[28px] bg-[#FFFEFC] border border-[#EFE5D8] overflow-hidden shadow-[0_8px_30px_rgba(40,20,10,0.04)] hover:shadow-[0_16px_36px_rgba(40,20,10,0.08)] hover:-translate-y-1 transition-all duration-300 pb-7"
              >
                {/* Top Image Banner with Wave & Badge */}
                <div className="relative aspect-[2.05/1] w-full overflow-hidden bg-[#FAF5EE]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image}
                    alt={item.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>

                {/* Content Area */}
                <div className="flex flex-1 flex-col px-4 pt-2">
                  {/* Step Number */}
                  <span className="text-[12px] font-serif italic text-[#C49A62] tracking-widest block text-center">
                    {item.step}
                  </span>

                  {/* Title */}
                  <h3 className="font-serif text-[17px] sm:text-[18px] font-bold text-[#20140D] text-center mt-1 group-hover:text-[#8D381B] transition-colors leading-snug">
                    {item.title}
                  </h3>

                  {/* Description */}
                  <p className="mt-2.5 text-xs sm:text-[12.5px] text-[#6B5E55] text-center leading-relaxed px-2 flex-1">
                    {item.desc}
                  </p>
                </div>

                {/* Corner Botanical Sketch Watermark */}
                <div className="pointer-events-none absolute bottom-1.5 left-2 opacity-35 text-[#CBB49C]">
                  <svg width="42" height="42" viewBox="0 0 42 42" fill="none" stroke="currentColor" strokeWidth="1">
                    <path d="M4 38 C12 30 18 24 28 14" />
                    <path d="M14 28 C20 22 24 24 26 18 C28 12 22 14 18 20" />
                    <path d="M22 20 Q 28 14 34 16 Q 30 24 22 20 Z" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Marble Ledge with Plumeria Flowers (Matching Hình 1) */}
        <div className="relative mt-12 sm:mt-16 w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/trust-bottom-ledge.png"
            alt="Lumière Spa Decor"
            className="w-full h-14 sm:h-20 lg:h-24 object-cover object-bottom"
          />
        </div>
      </section>

      {/* Contact + callback form (Synchronized from Homepage) */}
      <section id="lien-he" className="relative scroll-mt-20 overflow-hidden bg-[#FAF5EE] py-20 lg:py-28 border-t border-[#EFE5D8]">
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
                Hôm nay, hãy dành<br />
                thời gian cho <span className="font-serif italic text-[#8D381B]">chính mình</span>
                <span className="inline-block ml-2.5 align-middle text-[#8D381B]/80">
                  <Leaf className="h-6 w-6 sm:h-7 sm:w-7 inline-block -rotate-12" />
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
                <h3 className="mt-3 font-serif text-2xl sm:text-3xl font-medium leading-snug text-[#20140D]">
                  Để lại thông tin,<br />
                  Lumière Spa gọi lại tư vấn
                </h3>

                {/* Subtitle */}
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[#736357] font-light">
                  Chưa chắc chọn liệu trình nào, muốn mua gói hoặc thẻ quà tặng? Chuyên viên sẽ gọi lại trong giờ mở cửa để tư vấn chi tiết cho bạn.
                </p>

                {/* Interactive Lead Form with luxury styling */}
                <div className="mt-6">
                  <LeadForm source="offers_page" idPrefix="offers-contact-lead" luxury />
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
