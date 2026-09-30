import Link from 'next/link';
import { Calendar, MapPin, MessageCircle, Phone } from 'lucide-react';
import { Logo } from '@/components/logo';
import { SITE } from '@/lib/site-config';

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-[#1E120B] text-white pt-16 pb-10 sm:pt-20 sm:pb-12 border-t border-[#3A2417]">
      {/* Botanical floral line art - Left corner */}
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-72 w-72 select-none opacity-20 sm:opacity-25">
        <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
          {/* Stem & Leaves */}
          <path d="M10 190C45 150 70 110 95 65" stroke="#E5C290" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M45 150C30 135 15 130 5 135C5 120 20 120 40 135" stroke="#E5C290" strokeWidth="1" strokeLinecap="round" />
          <path d="M60 125C75 105 95 105 110 115C100 125 80 130 60 125" stroke="#E5C290" strokeWidth="1" strokeLinecap="round" />
          <path d="M30 170C15 175 5 185 0 195C15 190 25 185 35 180" stroke="#E5C290" strokeWidth="1" strokeLinecap="round" />
          {/* Flower Petals */}
          <path d="M95 65C85 45 65 35 45 45C35 60 45 80 70 80C80 80 90 75 95 65Z" stroke="#E5C290" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M95 65C105 40 125 30 145 40C155 55 145 75 125 80C110 82 100 75 95 65Z" stroke="#E5C290" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M95 65C90 85 80 100 65 110C50 95 55 75 75 70" stroke="#E5C290" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M95 65C110 85 125 95 140 90C145 75 135 65 115 65" stroke="#E5C290" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M85 55C80 30 95 15 110 20C120 30 115 50 95 65" stroke="#E5C290" strokeWidth="1.2" strokeLinecap="round" />
          {/* Center pistil details */}
          <circle cx="95" cy="62" r="3" stroke="#E5C290" strokeWidth="1" />
          <path d="M92 60L88 56M98 60L102 56M95 66L95 72" stroke="#E5C290" strokeWidth="1" strokeLinecap="round" />
        </svg>
      </div>

      {/* Botanical floral line art - Right corner */}
      <div className="pointer-events-none absolute -bottom-12 -right-8 h-72 w-72 select-none opacity-20 sm:opacity-25">
        <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
          {/* Stem & Leaves */}
          <path d="M190 190C155 150 130 110 105 65" stroke="#E5C290" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M155 150C170 135 185 130 195 135C195 120 180 120 160 135" stroke="#E5C290" strokeWidth="1" strokeLinecap="round" />
          <path d="M140 125C125 105 105 105 90 115C100 125 120 130 140 125" stroke="#E5C290" strokeWidth="1" strokeLinecap="round" />
          {/* Petals */}
          <path d="M105 65C115 45 135 35 155 45C165 60 155 80 130 80C120 80 110 75 105 65Z" stroke="#E5C290" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M105 65C95 40 75 30 55 40C45 55 55 75 75 80C90 82 100 75 105 65Z" stroke="#E5C290" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M105 65C110 85 120 100 135 110C150 95 145 75 125 70" stroke="#E5C290" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M105 65C90 85 75 95 60 90C55 75 65 65 85 65" stroke="#E5C290" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M115 55C120 30 105 15 90 20C80 30 85 50 105 65" stroke="#E5C290" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="105" cy="62" r="3" stroke="#E5C290" strokeWidth="1" />
        </svg>
      </div>

      <div className="relative z-10 mx-auto max-w-[1360px] px-6 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          {/* Column 1: Brand Info & Status (lg:col-span-4) */}
          <div className="lg:col-span-4">
            <Logo inverted />
            <p className="mt-4 max-w-[340px] text-xs sm:text-sm leading-relaxed text-[#C8BCB3] font-light">
              Một khoảng lặng dành để chăm sóc cơ thể và làm mới tinh thần.
            </p>

            <div className="mt-6 space-y-3 text-xs sm:text-sm">
              {/* Address */}
              <div className="flex items-start gap-3 text-[#EAE0D5]">
                <MapPin className="h-4 w-4 shrink-0 text-[#E5C290] mt-0.5" />
                <span className="leading-snug">{SITE.address}</span>
              </div>

              {/* Phone */}
              <div className="flex items-center gap-3 text-[#EAE0D5]">
                <Phone className="h-4 w-4 shrink-0 text-[#E5C290]" />
                <a href={`tel:${SITE.phone.replace(/\s+/g, '')}`} className="font-semibold hover:text-[#F3D7AC] transition-colors">
                  {SITE.phone}
                </a>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2.5 text-[#EAE0D5] font-light">
                <span className="h-2 w-2 rounded-full bg-[#4ADE80] shrink-0 animate-pulse" />
                <span>Đang mở cửa · đến {SITE.close || '20:00'}</span>
              </div>
            </div>
          </div>

          {/* Column 2: Khám phá (lg:col-span-2) */}
          <div className="lg:col-span-2 lg:pl-4">
            <h4 className="font-serif text-base sm:text-lg font-medium text-white mb-4">
              Khám phá
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li>
                <Link href="/" className="text-[#C8BCB3] transition-colors duration-200 hover:text-[#F3D7AC] font-light block">
                  Trang chủ
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-[#C8BCB3] transition-colors duration-200 hover:text-[#F3D7AC] font-light block">
                  Giới thiệu
                </Link>
              </li>
              <li>
                <Link href="/services" className="text-[#C8BCB3] transition-colors duration-200 hover:text-[#F3D7AC] font-light block">
                  Dịch vụ
                </Link>
              </li>
              <li>
                <Link href="/services" className="text-[#C8BCB3] transition-colors duration-200 hover:text-[#F3D7AC] font-light block">
                  Bảng giá
                </Link>
              </li>
              <li>
                <Link href="/offers" className="text-[#C8BCB3] transition-colors duration-200 hover:text-[#F3D7AC] font-light block">
                  Ưu đãi & quà tặng
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Hỗ trợ (lg:col-span-2) */}
          <div className="lg:col-span-2">
            <h4 className="font-serif text-base sm:text-lg font-medium text-white mb-4">
              Hỗ trợ
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li>
                <Link href="/booking" className="text-[#C8BCB3] transition-colors duration-200 hover:text-[#F3D7AC] font-light block">
                  Đặt lịch online
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-[#C8BCB3] transition-colors duration-200 hover:text-[#F3D7AC] font-light block">
                  Tư vấn liệu trình & Liên hệ
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-[#C8BCB3] transition-colors duration-200 hover:text-[#F3D7AC] font-light block">
                  Câu hỏi thường gặp
                </Link>
              </li>
              <li>
                <Link href="/about#chinh-sach" className="text-[#C8BCB3] transition-colors duration-200 hover:text-[#F3D7AC] font-light block">
                  Chính sách đặt / huỷ lịch
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Liên hệ nhanh (lg:col-span-4) */}
          <div className="lg:col-span-4 lg:pl-6">
            <h4 className="font-serif text-base sm:text-lg font-medium text-white mb-4">
              Liên hệ nhanh
            </h4>
            <div className="space-y-3.5">
              {/* Hotline item */}
              <a
                href={`tel:${SITE.phone.replace(/\s+/g, '')}`}
                className="group flex items-center gap-3 text-left transition-colors"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#E5C290] transition-colors group-hover:border-[#E5C290]/50 group-hover:bg-[#E5C290]/10">
                  <Phone className="h-4 w-4" />
                </span>
                <div>
                  <span className="block text-[11px] uppercase tracking-wider text-[#A8988A]">Hotline</span>
                  <strong className="block text-sm font-semibold text-white transition-colors group-hover:text-[#F3D7AC]">
                    {SITE.phone}
                  </strong>
                </div>
              </a>

              {/* Zalo item */}
              <a
                href={SITE.zalo}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 text-left transition-colors"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#E5C290] transition-colors group-hover:border-[#E5C290]/50 group-hover:bg-[#E5C290]/10">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <div>
                  <span className="block text-[11px] uppercase tracking-wider text-[#A8988A]">Zalo</span>
                  <span className="block text-sm text-[#EAE0D5] transition-colors group-hover:text-[#F3D7AC]">
                    Chat với chúng tôi
                  </span>
                </div>
              </a>

              {/* Chỉ đường item */}
              <a
                href={SITE.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 text-left transition-colors"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#E5C290] transition-colors group-hover:border-[#E5C290]/50 group-hover:bg-[#E5C290]/10">
                  <MapPin className="h-4 w-4" />
                </span>
                <div>
                  <span className="block text-[11px] uppercase tracking-wider text-[#A8988A]">Chỉ đường</span>
                  <span className="block text-sm text-[#EAE0D5] transition-colors group-hover:text-[#F3D7AC]">
                    Xem bản đồ
                  </span>
                </div>
              </a>

              {/* Gold Pill CTA Button */}
              <div className="pt-2">
                <Link
                  href="/booking"
                  className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-[#F6DCA6] via-[#E8C48A] to-[#DBA968] px-6 py-3 text-sm font-semibold text-[#3E2310] shadow-md shadow-black/30 transition-all duration-300 hover:brightness-105 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Calendar className="h-4 w-4 text-[#3E2310]" />
                  <span>Đặt lịch ngay &gt;</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom copyright & policies */}
        <div className="mt-12 sm:mt-16 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between text-xs text-[#A8988A]">
          <p>© 2026 Lumière Spa. Dành một chút thời gian cho chính bạn.</p>
          <div className="flex items-center gap-3 text-xs">
            <Link href="/about" className="hover:text-white transition-colors">
              Chính sách bảo mật
            </Link>
            <span>·</span>
            <Link href="/about" className="hover:text-white transition-colors">
              Điều khoản sử dụng
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
