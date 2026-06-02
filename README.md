# AirSave

AirSave is a full-stack micro-savings fintech application for tracking savings, managing goals, viewing wallet activity, and simulating mobile-money style payment flows.

The project is a JavaScript monorepo with a React/Vite frontend and an Express backend. AirSave now uses PostgreSQL + Prisma as the only datastore.

## Features

- Account registration, login, logout, session refresh, profile updates, password changes, and password reset flows
- JWT authentication with HTTP-only cookies, plus bearer-token fallback
- Wallet balance, deposits, withdrawals, transaction history, and double-entry ledger posting
- Savings goals with create, update, close, active-goal, and progress tracking flows
- Payment actions for savings deposits, send money, buy goods, paybill, and mock mobile-money confirmations
- Event-driven notifications through the PostgreSQL outbox
- Analytics and dashboard summary endpoints
- Responsive React UI

## Tech Stack

Frontend:

- React 19
- Vite 8
- React Router 7
- Axios
- Bootstrap 5
- Custom CSS

Backend:

- Node.js 20+
- Express 4
- PostgreSQL
- Prisma 7 with `@prisma/adapter-pg`
- JSON Web Tokens with `jsonwebtoken`
- Password hashing with `bcryptjs`
- HTTP security headers with `helmet`
- CORS with credential support
- Request logging with `morgan`
- Rate limiting with `express-rate-limit`
- Validation with `express-validator`
- Optional Redis for cache/session denylist behavior

## Project Structure

```text
AirSave/
+-- backend/
|   +-- config/          # Prisma, Redis, startup validation
|   +-- controllers/     # API request handlers
|   +-- middlewares/     # Auth, validation, rate limiting
|   +-- prisma/          # Prisma schema and migrations
|   +-- repositories/    # Prisma repositories
|   +-- routes/          # Express route modules
|   +-- services/        # Auth, wallet, goals, ledger, payments, notifications
|   +-- tests/           # Jest tests
|   +-- workers/         # Outbox worker
|   +-- server.js        # Express app entry point
+-- frontend/
|   +-- public/
|   +-- src/
+-- docs/
+-- scripts/
+-- render.yaml
```

## Prerequisites

- Node.js 20 or newer
- npm
- PostgreSQL database URL

## Local Development

Backend:

```bash
cd backend
npm install
npm run db:generate
npm run dev
```

Backend environment:

```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://airsave:airsave_password@localhost:5432/airsave?schema=public
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d
CLIENT_URLS=http://localhost:5173
ENABLE_OUTBOX_WORKER=false
REDIS_URL=
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Optional `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

## Backend Scripts

From `backend`:

```bash
npm run dev
npm start
npm run db:generate
npm run db:migrate:deploy
npm run verify:postgres
npm run worker:outbox
npm test
```

From the repository root:

```bash
npm run db:generate
npm run db:migrate:deploy
npm run verify:postgres
npm run cutover:check
npm test
```

## API Overview

- `/api/auth` - register, login, refresh, logout, current user, profile update, password change, password reset
- `/api/wallet` - wallet details, wallet deposit, wallet transaction history
- `/api/transactions` - payment initiation, send, buy goods, paybill, callbacks, status, activity, withdrawals
- `/api/goals` - create, list, active goal, update, close
- `/api/analytics` - authenticated analytics summary
- `/api/notifications` - list notifications and mark notifications as read
- `/api/payments` - payment initiation
- `/api/dashboard` - dashboard summary
- `/api/health/postgres` - PostgreSQL runtime health

## Production Deployment

Required environment variables:

```env
NODE_ENV=production
DATABASE_URL=your_postgres_database_url
JWT_SECRET=your_jwt_secret
ENABLE_OUTBOX_WORKER=false
```

Optional:

```env
PORT=5000
REDIS_URL=your_redis_url
CLIENT_URLS=https://your-frontend-origin.example
```

Recommended deployment checks:

```bash
npm run db:migrate:deploy
npm run verify:postgres
npm run cutover:check
```

Run the outbox worker as one separate process:

```bash
cd backend
npm run worker:outbox
```

See [docs/postgres-deployment.md](docs/postgres-deployment.md) and [docs/postgres-cutover.md](docs/postgres-cutover.md) for the deployment checklist.

## Contributor Notes

- Keep API changes aligned across backend routes, controllers, and `frontend/src/services/api.js`.
- Reuse existing React components before adding new UI primitives.
- Keep financial flows clear, auditable, and mobile-friendly.
- Avoid committing real `.env` files or secrets.
