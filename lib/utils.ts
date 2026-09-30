import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Vietnamese phone: 9–11 digits after removing spaces/dots/dashes, optional +84 prefix. */
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/[\s.\-()]/g, '').replace(/^\+84/, '0');
  return /^0\d{8,10}$/.test(digits);
}
