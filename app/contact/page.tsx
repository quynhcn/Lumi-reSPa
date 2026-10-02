'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  BookOpen,
  Car,
  Clock,
  Compass,
  Flower2,
  Heart,
  MapPin,
  PhoneCall,
} from 'lucide-react';
import { SITE, telHref } from '@/lib/site-config';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { LeadForm } from '@/components/landing/lead-form';
import { MobileActionBar } from '@/components/landing/contact-actions';

const FAQS = [
  {
    q: 'Tôi có cần đặt lịch trước khi đến không?',
    a: 'Để đảm bảo phòng riêng tư được chuẩn bị hoa nến chu đáo và kỹ thuật viên tay nghề tốt nhất sẵn sàng phục vụ, Lumière Spa khuyến khích quý khách nên đặt trước tối thiểu 1 - 2 giờ.',
  },
  {
    q: 'Đi ô tô đến spa có chỗ đậu xe an toàn không?',
    a: 'Lumière Spa có bãi đỗ xe ô tô và xe máy rộng rãi ngay trước cửa với bảo vệ túc trực 24/7, hoàn toàn miễn phí cho khách hàng sử dụng dịch vụ.',
  },
  {
    q: 'Nếu có việc bận đột xuất, tôi có thể đổi lịch hoặc hủy không?',
    a: 'Hoàn toàn được. Bạn có thể đổi giờ hoặc hủy lịch hẹn trước tối thiểu 2 giờ mà không mất bất kỳ khoản phí nào qua hotline hoặc trực tiếp trên website.',
  },
  {
    q: 'Spa có phòng đôi riêng cho cặp đôi hoặc mẹ con không?',
    a: 'Chúng tôi có các phòng đôi VIP tách biệt hoàn toàn, được trang bị phòng tắm, xông hơi và ánh sáng nến thơm dịu nhẹ, rất thích hợp cho cặp đôi, bạn thân hoặc mẹ con cùng thư giãn.',
  },
];

export default function ContactPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-[#FAF7F2] pb-16 sm:pb-0">
      <SiteHeader />

      {/* Hero Header matching Image 1 */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#FAF6F0] to-[#F3E9DD] pt-12 pb-16 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24">
        {/* Left Botanical Flourish */}
        <div className="pointer-events-none absolute -left-6 top-[20%] opacity-40 hidden md:block">
          <svg width="220" height="380" viewBox="0 0 220 380" fill="none" stroke="#CBB49C" strokeWidth="1.2">
            <circle cx="80" cy="95" r="7" fill="#E8D7C5" stroke="none" />
            <path d="M-20 250 C50 230 110 160 80 95 C55 50 10 20 -20 10" />
            <path d="M80 95 C120 80 160 115 145 155 C130 190 85 175 75 150" />
            <path d="M40 190 C80 190 95 230 70 255 C45 280 20 255 30 225" />
            <path d="M80 95 Q 105 70 115 90 Q 95 110 80 95 Z" fill="#F4EBE0" fillOpacity="0.4" />
          </svg>
        </div>

        {/* Right Botanical Flourish */}
        <div className="pointer-events-none absolute -right-6 top-[10%] opacity-40 hidden md:block">
          <svg width="220" height="420" viewBox="0 0 220 420" fill="none" stroke="#CBB49C" strokeWidth="1.2">
            <path d="M240 80 C160 120 100 200 135 290 C160 350 210 390 250 400" />
            <path d="M135 290 C90 310 40 270 60 220 C80 180 130 200 140 230" />
            <path d="M180 180 C130 180 110 130 140 100 C170 70 200 100 190 140" />
            <path d="M135 290 Q 105 320 95 295 Q 115 275 135 290 Z" fill="#F4EBE0" fillOpacity="0.4" />
          </svg>
        </div>

        {/* Bottom Organic Curve */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none z-10 pointer-events-none">
          <svg className="relative block w-full h-[60px] sm:h-[100px] lg:h-[160px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V120H0Z" opacity=".4" fill="#FAF7F2"></path>
            <path d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V120H0Z" opacity=".7" fill="#FAF7F2"></path>
            <path d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V120H0Z" fill="#FAF7F2"></path>
          </svg>
        </div>
        
        {/* Foreground Botanical branch bottom-left */}
        <div className="absolute bottom-0 left-0 z-20 opacity-90 hidden lg:block pointer-events-none mix-blend-multiply">
          <Image src="/contact/contact-botanical-left.jpg" alt="" width={320} height={240} className="h-[240px] w-auto opacity-20 grayscale sepia contrast-125" style={{ mixBlendMode: 'multiply' }} />
        </div>

        <div className="relative z-10 mx-auto max-w-[1240px] px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-14 lg:gap-8 items-center">
            
            {/* Left Content */}
            <div className="lg:col-span-6 xl:col-span-6 pt-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#D5C2B0] bg-[#F7F0E6]/90 px-3.5 py-1 text-[11px] sm:text-xs font-semibold tracking-wider text-[#8D381B] mb-5 shadow-sm">
                <Compass className="h-3.5 w-3.5" />
                <span>LIÊN HỆ &amp; ĐẶT HẸN · LUMIÈRE SPA</span>
              </div>

              <h1 className="font-serif text-[40px] sm:text-[56px] font-bold leading-[1.65] tracking-normal text-[#1F140E]">
                Chúng tôi luôn<br />
                sẵn sàng<br />
                <span className="italic font-normal text-[#8D381B]">lắng nghe bạn.</span>
              </h1>

              <p className="mt-5 max-w-[480px] text-[14px] sm:text-[15px] leading-relaxed text-[#604E44]">
                Hãy liên hệ với Lumière Spa để đặt lịch, tư vấn liệu trình hoặc nhận hỗ trợ nhanh chóng. Đội ngũ của chúng tôi luôn sẵn sàng đồng hành cùng bạn trên hành trình chăm sóc sức khỏe và sắc đẹp.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/booking"
                  className="inline-flex items-center gap-2 rounded-full bg-[#8D381B] px-7 py-3.5 text-sm font-semibold text-white shadow-md shadow-[#8D381B]/25 transition-all hover:bg-[#722A13] hover:-translate-y-0.5"
                >
                  <span>Đặt lịch ngay</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {/* Bottom Quick Info Row */}
              <div className="mt-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-2 lg:gap-4 pt-5 border-t border-[#E5D7C7]/60 w-full">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F5ECE1] text-[#8D381B]">
                    <Clock className="h-4 w-4" />
                  </span>
                  <div>
                    <strong className="block text-xs font-semibold text-[#20140D]">Giờ mở cửa</strong>
                    <span className="mt-0.5 block text-[11px] text-[#6B5E55]">09:00 – 20:00 hằng ngày</span>
                  </div>
                </div>
                <div className="hidden h-9 w-px bg-[#E5D7C7] sm:block" />
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F5ECE1] text-[#8D381B]">
                    <PhoneCall className="h-4 w-4" />
                  </span>
                  <div>
                    <strong className="block text-xs font-semibold text-[#20140D]">Hỗ trợ nhanh</strong>
                    <span className="mt-0.5 block text-[11px] text-[#6B5E55]">Phản hồi trong 5 phút</span>
                  </div>
                </div>
                <div className="hidden h-9 w-px bg-[#E5D7C7] sm:block" />
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F5ECE1] text-[#8D381B]">
                    <Car className="h-4 w-4" />
                  </span>
                  <div>
                    <strong className="block text-xs font-semibold text-[#20140D]">Chỗ đỗ xe</strong>
                    <span className="mt-0.5 block text-[11px] text-[#6B5E55]">Miễn phí tại spa</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Arch Visual matching Image 1 */}
            <div className="relative lg:col-span-6 xl:col-span-6 flex justify-end">
              <div className="relative w-full max-w-[440px] xl:max-w-[500px]">
                
                {/* Floating handwritten script */}
                <div className="absolute -top-12 -left-10 lg:-top-16 lg:-left-20 z-20 -rotate-6 hidden sm:block">
                  <span className="font-serif italic text-2xl lg:text-3xl text-[#C49A62] tracking-wide select-none drop-shadow-sm">
                    More than a spa.<br/>
                    <span className="ml-8">A kinder you.</span>
                  </span>
                </div>

                {/* The Main Arch */}
                <div className="relative z-10 aspect-[3.8/4.8] w-full overflow-hidden rounded-t-[300px] border-[3px] border-[#E8DEC1]/80 shadow-[0_24px_60px_rgba(40,20,10,0.12)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/spa-facade-thumb.jpg"
                    alt="Lumière Spa Luxury Day Spa"
                    className="h-full w-full object-cover"
                  />
                </div>

                {/* Vertical Text on the right edge */}
                <div className="absolute top-[10%] -right-12 z-0 hidden lg:flex flex-col items-center gap-3">
                  <span className="text-[11px] font-serif uppercase tracking-[0.3em] text-[#A69282] leading-[2.4] text-center" style={{ writingMode: 'vertical-rl' }}>
                    Sức khỏe<br/>Sắc đẹp<br/>Bình yên<br/>Là bạn
                  </span>
                  <span className="h-16 w-px bg-[#D5C2B0]"></span>
                </div>

                {/* Floating Cards Overlapping Arch */}
                <div className="absolute -right-6 sm:-right-16 top-[45%] flex flex-col gap-4 z-30 translate-y-[-50%] w-[260px] sm:w-[300px]">
                  {/* Card 1: Địa chỉ */}
                  <div className="group flex items-center justify-between rounded-[24px] bg-white/95 backdrop-blur-md p-3.5 sm:p-4.5 border border-[#EFE5D8] shadow-[0_12px_32px_rgba(40,20,10,0.08)] transition-transform hover:-translate-y-1">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <span className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-[#FAF5EE] border border-[#EADCCF] text-[#8D381B]">
                        <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
                      </span>
                      <div>
                        <strong className="block text-xs sm:text-[13px] font-semibold text-[#20140D]">Địa chỉ spa</strong>
                        <span className="mt-0.5 block text-[10px] sm:text-[11px] text-[#6B5E55] leading-snug">123 Lê Lợi, Quận 1,<br/>TP. Hồ Chí Minh</span>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-[#8D381B] mr-1 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </div>

                  {/* Card 2: Giờ mở cửa */}
                  <div className="group flex items-center justify-between rounded-[24px] bg-white/95 backdrop-blur-md p-3.5 sm:p-4.5 border border-[#EFE5D8] shadow-[0_12px_32px_rgba(40,20,10,0.08)] transition-transform hover:-translate-y-1 ml-4 sm:ml-8">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <span className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-[#FAF5EE] border border-[#EADCCF] text-[#8D381B]">
                        <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                      </span>
                      <div>
                        <strong className="block text-xs sm:text-[13px] font-semibold text-[#20140D]">Giờ mở cửa</strong>
                        <span className="mt-0.5 block text-[10px] sm:text-[11px] text-[#6B5E55] leading-snug">09:00 – 20:00<br/>hằng ngày</span>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-[#8D381B] mr-1 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </div>

                  {/* Card 3: Chỗ đỗ xe */}
                  <div className="group flex items-center justify-between rounded-[24px] bg-white/95 backdrop-blur-md p-3.5 sm:p-4.5 border border-[#EFE5D8] shadow-[0_12px_32px_rgba(40,20,10,0.08)] transition-transform hover:-translate-y-1">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <span className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-[#FAF5EE] border border-[#EADCCF] text-[#8D381B]">
                        <Car className="h-4 w-4 sm:h-5 sm:w-5" />
                      </span>
                      <div>
                        <strong className="block text-xs sm:text-[13px] font-semibold text-[#20140D]">Chỗ đỗ xe</strong>
                        <span className="mt-0.5 block text-[10px] sm:text-[11px] text-[#6B5E55] leading-snug">Có bãi đỗ xe an toàn,<br/>miễn phí cho khách hàng</span>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-[#8D381B] mr-1 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Main Form & Location Section matching Image 2 */}
      <section className="relative overflow-hidden bg-[#FAF7F2] py-10 lg:py-16">
        {/* Background botanical corners */}
        <div className="pointer-events-none absolute left-0 top-0 opacity-40 mix-blend-multiply hidden sm:block">
          {/* Using a subtle decorative svg for corner */}
          <svg width="300" height="400" viewBox="0 0 300 400" fill="none" stroke="#CBB49C" strokeWidth="1">
            <path d="M-50 300 C50 250 150 150 100 50" />
            <path d="M0 350 C100 320 200 200 150 80" />
            <path d="M-20 400 C150 380 250 250 200 120" />
          </svg>
        </div>
        <div className="pointer-events-none absolute right-0 bottom-0 opacity-40 mix-blend-multiply hidden sm:block">
          <svg width="300" height="400" viewBox="0 0 300 400" fill="none" stroke="#CBB49C" strokeWidth="1">
            <path d="M350 100 C250 150 150 250 200 350" />
            <path d="M300 50 C200 80 100 200 150 320" />
            <path d="M320 0 C150 20 50 150 100 280" />
          </svg>
        </div>

        <div className="relative z-10 mx-auto max-w-[1240px] px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            
            {/* Left Form Card */}
            <div className="lg:col-span-6 rounded-[32px] bg-[#FAF6F0] p-7 sm:p-10 border border-[#EFE5D8] shadow-[0_8px_40px_rgba(40,20,10,0.03)] flex flex-col justify-center">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9B3E1F]">
                    GỬI YÊU CẦU TƯ VẤN
                  </span>
                  <span className="h-px w-10 bg-[#9B3E1F]/40"></span>
                </div>
                <h2 className="font-serif text-3xl sm:text-[38px] font-bold text-[#20140D] leading-tight">
                  Đặt lịch tư vấn miễn phí
                </h2>
                <p className="mt-3 text-[13.5px] leading-relaxed text-[#6B5E55] max-w-[420px]">
                  Chuyên viên tư vấn của Lumière Spa sẽ liên hệ qua điện thoại để phản hồi chi tiết và giúp bạn lựa chọn liệu trình phù hợp nhất.
                </p>
              </div>

              <LeadForm
                source="contact_page"
                idPrefix="contact"
                luxury={true}
                interest="Chưa biết chọn dịch vụ nào"
              />
            </div>

            {/* Right Column: Ambiance & Map */}
            <div className="lg:col-span-6 flex flex-col gap-6">
              
              {/* Ambiance & Visiting Advice Card */}
              <div className="rounded-[32px] border border-[#EFE5D8] bg-white p-5 sm:p-7 shadow-[0_8px_40px_rgba(40,20,10,0.03)] flex-1">
                <div className="aspect-[16/7.5] w-full overflow-hidden rounded-[24px] mb-6 border border-[#E5DDD2]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/contact/contact-form-towels.jpg"
                    alt="Không gian thư giãn tại Lumière Spa"
                    className="h-full w-full object-cover"
                  />
                </div>

                <h3 className="px-2 font-serif text-2xl font-bold text-[#20140D]">
                  Lưu ý nhỏ khi ghé thăm <span className="italic text-[#8D381B]">Lumière Spa</span>
                </h3>

                <div className="mt-6 space-y-5 px-2">
                  <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FAF5EE] text-[#8D381B]">
                      <Clock className="h-5 w-5" />
                    </span>
                    <div>
                      <strong className="block text-[14px] font-bold text-[#20140D]">Đến trước 10 – 15 phút</strong>
                      <span className="mt-0.5 block text-[13px] text-[#6B5E55] leading-relaxed">để thư giãn và thưởng trà trước liệu trình.</span>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FAF5EE] text-[#8D381B]">
                      <Heart className="h-5 w-5" />
                    </span>
                    <div>
                      <strong className="block text-[14px] font-bold text-[#20140D]">Bạn có thể yêu cầu kỹ thuật viên quen thuộc</strong>
                      <span className="mt-0.5 block text-[13px] text-[#6B5E55] leading-relaxed">hoặc chia sẻ nhu cầu trị liệu để được tư vấn phù hợp nhất.</span>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FAF5EE] text-[#8D381B]">
                      <Flower2 className="h-5 w-5" />
                    </span>
                    <div>
                      <strong className="block text-[14px] font-bold text-[#20140D]">Không gian giữ sự yên tĩnh</strong>
                      <span className="mt-0.5 block text-[13px] text-[#6B5E55] leading-relaxed">để mọi khách hàng đều được thư giãn trọn vẹn.</span>
                    </div>
                  </div>
                </div>

                <div className="mt-7 pt-5 border-t border-[#F2EAE0] px-2 flex justify-end">
                  <Link
                    href="/booking"
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-[#8D381B] hover:underline"
                  >
                    Đặt phòng ngay <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              {/* Location Map Card */}
              <div className="rounded-[32px] border border-[#EFE5D8] bg-[#FAF5EE] p-5 shadow-[0_8px_40px_rgba(40,20,10,0.03)] flex flex-col sm:flex-row gap-6 items-center">
                <div className="flex-1 px-2 text-center sm:text-left">
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#9B3E1F] mb-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>VỊ TRÍ TRUNG TÂM</span>
                  </div>
                  <h4 className="font-serif text-[22px] font-bold text-[#20140D]">
                    {SITE.name} · {SITE.addressParts.district}
                  </h4>
                  <p className="mt-1 text-[13px] text-[#6B5E55]">{SITE.address}</p>
                  
                  <a
                    href={SITE.mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-white border border-[#E8DACB] px-5 py-2.5 text-sm font-semibold text-[#8D381B] hover:bg-[#FAF4EC] transition-colors shadow-sm w-full sm:w-auto"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span>Mở bản đồ</span>
                  </a>
                </div>
                
                <div className="w-full sm:w-[240px] shrink-0 aspect-[4/2.5] sm:aspect-[4/3] rounded-[24px] overflow-hidden border border-[#E8DACB]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/contact/contact-map-d1.jpg"
                    alt="Bản đồ đường đi Lumière Spa"
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section className="mx-auto max-w-[1240px] px-6 py-10 lg:py-16">
        <div className="max-w-2xl mx-auto text-center mb-10">
          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.22em] text-[#9B3E1F]">
            GIẢI ĐÁP THẮC MẮC
          </span>
          <h2 className="mt-2 font-serif text-2xl sm:text-3xl font-bold text-[#20140D]">
            Câu hỏi thường gặp <span className="italic text-[#8D381B]">(FAQ)</span>
          </h2>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          {FAQS.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div
                key={index}
                className="overflow-hidden rounded-[20px] border border-[#EFE5D8] bg-white transition-all shadow-[0_4px_20px_rgba(40,20,10,0.02)]"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  className="flex w-full items-center justify-between p-5 text-left font-serif text-base sm:text-lg font-bold text-[#20140D] hover:text-[#8D381B] transition-colors"
                >
                  <span>{faq.q}</span>
                  <span className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FAF5EE] text-[#8D381B] text-sm">
                    {isOpen ? '−' : '+'}
                  </span>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-[13.5px] leading-relaxed text-[#6B5E55] border-t border-[#F5ECE1]">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <SiteFooter />
      <MobileActionBar />
    </div>
  );
}

