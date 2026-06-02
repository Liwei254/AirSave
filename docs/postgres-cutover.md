# PostgreSQL Cutover Runbook

AirSave has completed its datastore cutover. PostgreSQL with Prisma is now the only runtime persistence layer.

## Required Environment Variables

```bash
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
JWT_SECRET=<strong random secret>
ENABLE_OUTBOX_WORKER=false
REDIS_URL=<optional Redis URL>
```

Use `ENABLE_OUTBOX_WORKER=true` only when a single API process should also poll the outbox. Prefer a separate worker process in production.

## Deployment Order

1. Back up PostgreSQL.
2. Deploy the current code.
3. Generate Prisma client.
4. Apply Prisma migrations.
5. Run PostgreSQL ledger verification.
6. Check `GET /api/health/postgres`.
7. Run the final cutover checklist.
8. Start the dedicated outbox worker.

## Commands

Generate Prisma client:

```bash
cd backend
npx prisma generate
```

Apply migrations:

```bash
npm run db:migrate:deploy
```

Verify ledger integrity:

```bash
npm run verify:postgres
```

Run the final cutover checklist:

```bash
npm run cutover:check
```

Check API health after deploy:

```bash
curl http://localhost:5000/api/health/postgres
```

Start the outbox worker separately:

```bash
cd backend
npm run worker:outbox
```

## Final Checklist

- PostgreSQL backup or snapshot completed.
- Prisma migrations applied.
- `npm run verify:postgres` passed.
- `npm run cutover:check` passed.
- `GET /api/health/postgres` returns success.
- Outbox worker is running.
- Required production env vars are configured.
- Rollback database snapshot is available.

## Rollback Strategy

1. Restore the previous app release if needed.
2. Restore PostgreSQL from a known-good backup if data has been affected.
3. Stop the dedicated outbox worker while investigating.
4. Keep PostgreSQL data and verification reports intact for root-cause analysis.
