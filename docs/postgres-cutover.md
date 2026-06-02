# PostgreSQL Cutover Runbook

This runbook prepares AirSave to switch runtime traffic from MongoDB to PostgreSQL after the Mongo data migration has been verified. MongoDB remains the default datastore unless a Postgres switch is explicitly set.

## Required Environment Variables

Set MongoDB for the source migration:

```bash
MONGO_URI=mongodb://...
MONGODB_URI=mongodb://...
```

Set PostgreSQL for Prisma:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
```

Enable PostgreSQL runtime by setting at least one switch:

```bash
DATA_STORE=postgres
DATABASE_PROVIDER=postgres
DB_PROVIDER=postgres
```

Outbox worker:

```bash
ENABLE_OUTBOX_WORKER=false
```

Use `ENABLE_OUTBOX_WORKER=true` only when the API process should also poll the outbox. Prefer a separate worker process in production.

## Migration Order

1. Back up MongoDB and PostgreSQL.
2. Deploy code with MongoDB still serving runtime traffic.
3. Generate Prisma client and apply Prisma migrations.
4. Run the Mongo to Postgres migration in dry-run mode.
5. Review the generated migration report.
6. Run the real migration with `--execute`.
7. Run PostgreSQL ledger verification.
8. Check `GET /api/health/postgres`.
9. Start the outbox worker.
10. Flip runtime environment to PostgreSQL.

## Commands

Generate Prisma client:

```bash
cd backend
npx prisma generate
```

Dry-run migration:

```bash
npm run migrate:mongo:dry-run
```

Execute migration:

```bash
npm run migrate:mongo:execute
```

Scoped execute examples:

```bash
node scripts/migrateMongoToPostgres.js --execute --users
node scripts/migrateMongoToPostgres.js --execute --goals
node scripts/migrateMongoToPostgres.js --execute --transactions
node scripts/migrateMongoToPostgres.js --execute --notifications
```

Verify ledger integrity:

```bash
npm run verify:postgres
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

## Enabling PostgreSQL Runtime

After migration and verification pass, set one datastore switch in the API environment:

```bash
DATA_STORE=postgres
```

The existing MongoDB routes and services remain in place. If no switch is set, AirSave continues using MongoDB.

## Rollback Strategy

1. Set `DATA_STORE`, `DATABASE_PROVIDER`, and `DB_PROVIDER` back to empty or remove them.
2. Restart the API process so MongoDB becomes the runtime datastore again.
3. Stop the outbox worker if it is only needed for PostgreSQL-mode notifications.
4. Keep PostgreSQL data intact for investigation; do not truncate tables automatically.
5. Review the latest migration report under `migration-reports/` and the verification output before attempting another cutover.

## Cutover Checklist

- MongoDB backup completed.
- PostgreSQL backup or snapshot completed.
- Prisma migrations applied.
- `npm run migrate:mongo:dry-run` report reviewed.
- `npm run migrate:mongo:execute` completed.
- `npm run verify:postgres` passed.
- `GET /api/health/postgres` returns success.
- Outbox worker is running.
- Runtime switch is set to PostgreSQL.
- Rollback environment values are ready.
