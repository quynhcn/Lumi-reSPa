import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAF7F2]">
      <SiteHeader />
      <main className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <h1 className="font-serif text-6xl font-bold text-[#8D381B] mb-4">404</h1>
        <h2 className="font-serif text-3xl font-bold text-[#20140D] mb-4">Trang không tồn tại</h2>
        <p className="text-[#6B5E55] max-w-md mb-8">
          Đường dẫn bạn truy cập có thể đã bị thay đổi hoặc không còn tồn tại trên hệ thống của Lumière Spa.
        </p>
        <Link href="/">
          <Button className="bg-[#8D381B] text-white hover:bg-[#722A13] px-8 py-6 rounded-full text-lg shadow-md hover:shadow-lg">
            Về trang chủ
          </Button>
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
