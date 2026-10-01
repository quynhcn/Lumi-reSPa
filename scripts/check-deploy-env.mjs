#!/usr/bin/env node

const required = ['DATABASE_URL', 'CRON_SECRET', 'NEXT_PUBLIC_SITE_URL'];
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

console.log('Deployment environment validation passed.');
