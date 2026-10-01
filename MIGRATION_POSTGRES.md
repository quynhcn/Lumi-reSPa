# PostgreSQL deployment guide

The application uses PostgreSQL directly. Supabase import tooling is no longer part of the supported deployment path.

## Required environment

- `DATABASE_URL`: application database connection string.
- `DATABASE_SSL=require`: use TLS when required by the provider.
- `CRON_SECRET`: bearer secret for scheduled jobs.
- `NEXT_PUBLIC_SITE_URL`: canonical HTTPS origin.

## Apply schema

Use a dedicated database for each production, staging, and preview environment.

```bash
npm ci
npm run db:migrate
npm run db:status
npm run typecheck
npm run lint
npm run build
```

Migrations are transactional and protected by an advisory lock. A changed checksum is treated as a deployment error. Never edit an already-applied migration; add a new numbered migration instead.

The approved service and promotion catalogue is installed by migrations and can subsequently be maintained from the admin UI.

## Release smoke test

1. Verify `/api/health` returns `status: ok`.
2. Verify the homepage and `/services` show the canonical catalogue.
3. Sign in as admin and check staff, schedules, services, promotions, and appointments.
4. Complete one test booking, reschedule it, then cancel it.
5. Verify customer and staff accounts cannot read data outside their role.
6. Register a customer account, sign in, and complete one booking.

## Scheduled jobs

Call the cleanup cron route with `Authorization: Bearer <CRON_SECRET>`. Do not reuse production credentials in preview deployments.
