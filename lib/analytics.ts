/**
 * Funnel tracking (Google Analytics 4). No-op when NEXT_PUBLIC_GA_ID is not set.
 *
 * Booking funnel events (in order) — build a "Funnel exploration" in GA4 with these steps:
 *   view_services → select_service → select_staff → select_slot → begin_checkout → booking_complete
 * Other events: quick_book_parse, lead_submit, click_call, click_directions,
 *   apply_gift_code, sign_up, login, review_submit, cancel_booking
 */
type Params = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(event: string, params: Params = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  try {
    window.gtag('event', event, params);
  } catch {
    // analytics must never break the app
  }
}

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || '';
