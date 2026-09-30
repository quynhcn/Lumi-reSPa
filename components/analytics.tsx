import Script from 'next/script';
import { GA_ID } from '@/lib/analytics';

/**
 * Google Analytics 4. Set NEXT_PUBLIC_GA_ID=G-XXXXXXX to enable.
 * Page views on client-side navigation are sent automatically by GA4 "Enhanced measurement".
 */
export function Analytics() {
  if (!GA_ID) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${GA_ID}');`}
      </Script>
    </>
  );
}
