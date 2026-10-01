'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF7F2]">
      <SiteHeader />
      <main className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <h1 className="font-serif text-4xl font-bold text-[#20140D] mb-4">Đã xảy ra lỗi hệ thống!</h1>
        <p className="text-[#6B5E55] max-w-md mb-8">
          Rất tiếc, đã có lỗi kỹ thuật xảy ra. Chúng tôi đang khắc phục vấn đề này. Mong bạn thông cảm và thử lại.
        </p>
        <div className="flex gap-4">
          <Button
            onClick={() => reset()}
            className="bg-[#8D381B] text-white hover:bg-[#722A13]"
          >
            Thử lại
          </Button>
          <Link href="/">
            <Button variant="outline" className="border-[#8D381B] text-[#8D381B]">
              Về trang chủ
            </Button>
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
