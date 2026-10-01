import pg from 'pg';
const { Client } = pg;

const PROMOTIONS = [
  {
    id: 'first-visit',
    badge: 'DÀNH CHO KHÁCH HÀNG MỚI',
    title: 'Ưu Đãi Trải Nghiệm Lần Đầu',
    discount: 'GIẢM 10%',
    subtitle: 'Áp dụng cho mọi liệu trình đơn lẻ hoặc combo tại Lumière Spa',
    desc: 'Lần đầu ghé thăm Lumière Spa, bạn được giảm trực tiếp 10% trên hóa đơn dịch vụ bất kỳ cùng một set trà thảo mộc & ngâm chân muối khoáng chào đón hoàn toàn miễn phí.',
    code: null,
    validUntil: 'Áp dụng đến hết tháng này',
    image: '/offer-first-visit.jpg',
    highlights: [
      'Áp dụng cho tất cả dịch vụ trong thực đơn',
      'Tặng kèm 15 phút ngâm chân thảo mộc & thưởng trà hoa',
      'Được chọn kỹ thuật viên theo yêu cầu',
      'Không phụ thu cuối tuần hay ngày lễ',
    ],
    ctaText: 'Đặt lịch nhận ưu đãi ngay',
    href: '/booking',
  },
  {
    id: 'vip-member',
    badge: 'GÓI HỘI VIÊN TIẾT KIỆM',
    title: 'Thẻ Hội Viên VIP Thư Thái',
    discount: 'TIẾT KIỆM 25%',
    subtitle: 'Gói 10 buổi trị liệu chuyên sâu không giới hạn thời gian sử dụng',
    desc: 'Thiết kế riêng cho khách hàng duy trì thói quen chăm sóc sức khỏe và làn da định kỳ. Tiết kiệm chi phí vượt trội và nhận nhiều đặc quyền phòng VIP độc quyền.',
    code: null,
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
    code: null,
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
    code: null,
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

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'require' ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  
  await client.query('TRUNCATE public.promotions');

  for (const [idx, promo] of PROMOTIONS.entries()) {
    await client.query(
      `INSERT INTO public.promotions (
        code, badge, title, discount, subtitle, description, valid_until, image_url, highlights, cta_text, href, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        promo.code,
        promo.badge,
        promo.title,
        promo.discount,
        promo.subtitle,
        promo.desc,
        promo.validUntil,
        promo.image,
        JSON.stringify(promo.highlights),
        promo.ctaText,
        promo.href,
        idx
      ]
    );
  }
  
  console.log('Inserted mock promotions to DB');
  await client.end();
}

main().catch(console.error);
