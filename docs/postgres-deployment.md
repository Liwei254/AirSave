# PostgreSQL Deployment

AirSave now uses PostgreSQL with Prisma as its only datastore. Runtime datastore switches have been removed.

## Local Setup

Install dependencies:

```bash
npm install
cd backend
npm install
```

Set the backend environment:

```bash
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public
JWT_SECRET=local-development-secret
ENABLE_OUTBOX_WORKER=false
REDIS_URL=
```

Generate Prisma client:

```bash
npm run db:generate
```

Apply migrations:

```bash
npm run db:migrate:deploy
```

## Render Setup

Use `backend` as the Render web service root directory.

Recommended environment variables:

```bash
NODE_ENV=production
PORT=5000
DATABASE_URL=<Render or external Postgres URL>
JWT_SECRET=<strong random secret>
ENABLE_OUTBOX_WORKER=false
REDIS_URL=<optional Redis URL>
```

Run migrations during deploy:

```bash
npm run db:migrate:deploy
```

## Railway Setup

Set variables on the backend service:

```bash
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<strong random secret>
ENABLE_OUTBOX_WORKER=false
REDIS_URL=<optional Redis URL>
```

If Railway runs commands from the backend folder:

```bash
npm run db:migrate:deploy
npm run verify:postgres
```

## Supabase, Neon, and Managed Postgres URLs

Use the provider-recommended server runtime connection string for `DATABASE_URL`.

Prisma migrations generally work best with a direct database URL. If your provider gives separate pooled and direct URLs, use the direct URL for migration jobs and the pooled URL for web runtime only if the provider recommends it.

Never log `DATABASE_URL`. Startup logs only report whether it is configured.

## Commands

```bash
npm run db:generate
npm run db:migrate:deploy
npm run verify:postgres
npm run postdeploy:postgres
npm run cutover:check
```

## Outbox Worker

Prefer one separate worker process:

```bash
cd backend
npm run worker:outbox
```

Set this in web services:

```bash
ENABLE_OUTBOX_WORKER=false
```

Set `ENABLE_OUTBOX_WORKER=true` only for a single-process deployment or a dedicated worker. Startup validation warns when the worker is enabled in production because duplicate web replicas can process the same operational workload.

## Startup Validation

The API fails fast when:

- `DATABASE_URL` is missing.
- `NODE_ENV=production` and `JWT_SECRET` is missing.

The boot checklist logs:

- selected datastore: `postgres`
- selected provider: `prisma`
- outbox worker enabled or disabled
- mounted health endpoint
- node environment
- port

Secrets are never logged.

## Health and Verification

Health endpoint:

```bash
GET /api/health/postgres
```

Financial verification:

```bash
npm run verify:postgres
```

Run verification after migrations and before promoting a deployment.

## Rollback Strategy

Rollback is now an application/database deployment rollback:

1. Restore the previous application release if needed.
2. Restore PostgreSQL from a known-good backup or snapshot if data integrity is affected.
3. Stop the outbox worker if the deployment is paused.
4. Keep failed verification output and logs for investigation.

Do not truncate PostgreSQL tables automatically during rollback.
