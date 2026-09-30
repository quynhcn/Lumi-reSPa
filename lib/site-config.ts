/**
 * Business info shown on the public site (header, contact section, SEO structured data).
 * TODO trước khi go-live: thay bằng thông tin thật.
 */
export const SITE = {
  name: 'Lumière Spa',
  tagline: 'Một khoảng lặng dành riêng cho bạn',
  /** Public URL — used for canonical links, sitemap and structured data */
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://lumierespa.vn',
  address: '123 Lê Lợi, Quận 1, TP.HCM',
  addressParts: { street: '123 Lê Lợi', district: 'Quận 1', city: 'TP. Hồ Chí Minh', country: 'VN' },
  /** Google Maps search / place link */
  mapUrl: 'https://maps.google.com/?q=123+L%C3%AA+L%E1%BB%A3i+Qu%E1%BA%ADn+1',
  phone: '1900 1234',
  /** Zalo number or OA link, e.g. https://zalo.me/0901234567 */
  zalo: 'https://zalo.me/0901234567',
  /** Opening hours (spa local time), same every day */
  open: '09:00',
  close: '20:00',
  hours: '09:00 – 20:00 hằng ngày',
  /** Khách tự hủy lịch được trước giờ hẹn bao nhiêu giờ (phải khớp với RPC cancel_my_appointment) */
  cancelBeforeHours: 2,
  /** Tin nhắn nhắc lịch (lễ tân gửi thủ công qua Zalo/SMS). Biến: {name} {service} {time} {date} {code} */
  reminderTemplate:
    'Lumière Spa xin chào {name}! Nhắc lịch {service} lúc {time} ngày {date} (mã {code}). Vui lòng đến trước 10 phút. Cần đổi lịch xin nhắn lại tin này nhé.',
  /** Link "Viết đánh giá" trên Google Maps (Google Business Profile → Chia sẻ biểu mẫu đánh giá). Để trống nếu chưa có. */
  googleReviewUrl: process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL || '',
  /** Tin xin đánh giá sau buổi hẹn. Biến: {name} {service} {link} {gift} */
  reviewTemplate:
    'Lumière Spa cảm ơn {name} đã ghé làm {service}! Chị/anh dành 30 giây chấm điểm giúp spa nhé: {link}{gift}',
  /** Phần quà kèm tin xin đánh giá. Biến: {code} {pct} {date} */
  reviewGiftTemplate: ' Quà cảm ơn: mã {code} giảm {pct}% cho lần sau (HSD {date}).',
};

/** Phone number digits for tel:/sms: links */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
/** Zalo chat link for a Vietnamese phone number */
export const zaloHref = (phone: string) => `https://zalo.me/${phone.replace(/\D/g, '').replace(/^84/, '0')}`;
