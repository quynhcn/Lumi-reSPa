import './globals.css';
import type { Metadata } from 'next';
import { Quicksand } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/lib/auth-context';
import { Analytics } from '@/components/analytics';
import { SITE } from '@/lib/site-config';

const quicksand = Quicksand({
  subsets: ['latin', 'vietnamese'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-quicksand',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s · ${SITE.name}` },
  description:
    'Spa massage, chăm sóc da, gội đầu dưỡng sinh tại ' + SITE.addressParts.district + ', ' + SITE.addressParts.city +
    '. Xem giá, giờ trống và đặt lịch online trong 1 phút.',
  alternates: { canonical: '/' },
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: 'Massage, chăm sóc da, gội đầu dưỡng sinh. Đặt lịch online, ưu đãi cho lần đầu.',
    images: ['/spa-hero.webp'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={`${quicksand.variable}`}>
      <head>
        <link rel="icon" type="image/png" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body className={`${quicksand.variable} font-sans antialiased`}>
        <AuthProvider>
          {children}
          <Toaster richColors position="top-center" />
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
