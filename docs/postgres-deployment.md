# PostgreSQL Deployment Hardening

This guide covers production deployment for AirSave when PostgreSQL is enabled. MongoDB remains the default datastore unless a Postgres switch is set.

## Local Setup

Install dependencies:

```bash
npm install
cd backend
npm install
```

Set MongoDB for the default runtime:

```bash
MONGO_URI=mongodb://127.0.0.1:27017/airsave
JWT_SECRET=local-development-secret
```

Set PostgreSQL for opt-in runtime:

```bash
DATA_STORE=postgres
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public
JWT_SECRET=local-development-secret
ENABLE_OUTBOX_WORKER=false
```

Generate Prisma client:

```bash
npm run db:generate
```

## Render Setup

Use the backend service as the web service.

Recommended settings:

```bash
NODE_ENV=production
DATA_STORE=postgres
DATABASE_URL=<Render or external Postgres internal URL>
JWT_SECRET=<strong random secret>
ENABLE_OUTBOX_WORKER=false
```

Use a separate Render worker service for outbox processing:

```bash
cd backend && npm run worker:outbox
```

Run migrations during deploy:

```bash
npm run db:migrate:deploy
```

## Railway Setup

Set variables on the backend service:

```bash
NODE_ENV=production
DATA_STORE=postgres
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<strong random secret>
ENABLE_OUTBOX_WORKER=false
```

Deploy the outbox worker as a separate Railway service with:

```bash
cd backend && npm run worker:outbox
```

If Railway runs commands from the backend folder, use:

```bash
npm run db:migrate:deploy
npm run verify:postgres
```

## Supabase, Neon, and Managed Postgres URLs

Use the pooled or direct connection string recommended by the provider for server runtimes.

Prisma migrations generally work best with a direct database URL. If your provider gives separate pooled and direct URLs, use the direct URL for migration jobs and the pooled URL for web runtime only if the provider recommends it.

Never log `DATABASE_URL`. The startup checklist only reports whether it is configured.

## Migration Commands

Apply Prisma migrations:

```bash
npm run db:migrate:deploy
```

Generate Prisma client:

```bash
npm run db:generate
```

Run the Mongo to Postgres migration dry-run:

```bash
npm run migrate:mongo:dry-run
```

Execute the Mongo to Postgres migration:

```bash
npm run migrate:mongo:execute
```

Verify financial integrity:

```bash
npm run verify:postgres
```

Post-deploy Postgres check:

```bash
npm run postdeploy:postgres
```

## Worker Deployment Strategy

Do not run the outbox worker in every scaled web replica. Prefer one separate worker process:

```bash
cd backend
npm run worker:outbox
```

Set this in web services:

```bash
ENABLE_OUTBOX_WORKER=false
```

Set this only for a single-process deployment or a dedicated worker:

```bash
ENABLE_OUTBOX_WORKER=true
```

Startup validation warns when the worker is enabled in production because duplicate web replicas can process the same operational workload.

## Startup Validation

The API fails fast when:

- Postgres mode is enabled and `DATABASE_URL` is missing.
- Mongo mode is enabled and neither `MONGO_URI` nor `MONGODB_URI` is set.
- `NODE_ENV=production` and `JWT_SECRET` is missing.

The boot checklist logs:

- selected datastore
- selected provider
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

Run verification after migrations, after Mongo data migration, and before switching production traffic to Postgres.

## Rollback Strategy

1. Remove `DATA_STORE`, `DATABASE_PROVIDER`, and `DB_PROVIDER`, or set them away from `postgres`.
2. Restart the web service.
3. Stop the dedicated outbox worker if it is only used for Postgres mode.
4. Keep PostgreSQL data intact for investigation.
5. Continue serving from MongoDB while reviewing migration reports and `verify:postgres` output.

Do not truncate PostgreSQL or delete MongoDB data automatically during rollback.
