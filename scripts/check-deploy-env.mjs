#!/usr/bin/env node

const required = ['DATABASE_URL', 'CRON_SECRET', 'OTP_PEPPER', 'NEXT_PUBLIC_SITE_URL'];
const missing = required.filter((name) => !String(process.env[name] || '').trim());

if (missing.length) {
  console.error(`Deployment blocked: missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const siteUrl = String(process.env.NEXT_PUBLIC_SITE_URL);
try {
  const parsed = new URL(siteUrl);
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') throw new Error();
} catch {
  console.error('Deployment blocked: NEXT_PUBLIC_SITE_URL must be a valid HTTPS URL.');
  process.exit(1);
}

if (process.env.SMS_PROVIDER === 'console' && process.env.SMS_ALLOW_CONSOLE !== 'true') {
  console.error('Deployment blocked: SMS_PROVIDER=console is not allowed in production.');
  process.exit(1);
}

console.log('Deployment environment validation passed.');
