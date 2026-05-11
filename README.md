# AirSave

AirSave is a full-stack micro-savings fintech application for tracking savings, managing goals, viewing wallet activity, and simulating mobile-money style payment flows.

The project is built as a JavaScript monorepo with a React/Vite frontend and an Express/MongoDB backend. In production, the backend can serve both the API and the built frontend from one Render web service.

## Features

- Account registration, login, logout, session refresh, profile updates, password changes, and password reset flows
- JWT-based authentication with HTTP-only cookies, plus bearer-token fallback for client requests
- Savings dashboard with protected routes
- Wallet balance, deposits, withdrawals, and transaction history
- Savings goals with create, update, delete, active-goal, and progress tracking flows
- Payment actions for savings deposits, send money, buy goods, paybill, and mock mobile-money confirmations
- Notifications for savings, payment, and goal activity
- Analytics endpoint for user savings insights
- Responsive React UI using Bootstrap and custom CSS
- Render deployment configuration for a single Node web service

## Tech Stack

### Frontend

- React 19
- Vite 8
- React Router 7
- Axios
- Bootstrap 5
- Custom CSS
- ESLint

### Backend

- Node.js 20+
- Express 4
- MongoDB with Mongoose
- JSON Web Tokens with `jsonwebtoken`
- Password hashing with `bcryptjs`
- HTTP security headers with `helmet`
- CORS with credential support
- Request logging with `morgan`
- Rate limiting with `express-rate-limit`
- Validation with `express-validator`

### Deployment

- Render Web Service
- Backend root directory: `backend`
- Frontend build output: `frontend/dist`
- Production backend serves API routes under `/api`
- Production backend serves the frontend build when `NODE_ENV=production`

## Project Structure

```text
AirSave/
+-- backend/
|   +-- config/          # MongoDB connection
|   +-- controllers/     # API request handlers
|   +-- middlewares/     # Auth, validation, rate limiting
|   +-- models/          # Mongoose schemas
|   +-- routes/          # Express route modules
|   +-- services/        # Ledger and payment business logic
|   +-- utils/           # Auth, JWT, rounding helpers
|   +-- validators/      # express-validator schemas
|   +-- server.js        # Express app entry point
+-- frontend/
|   +-- public/          # Static assets and redirects
|   +-- src/
|   |   +-- components/  # Shared UI components
|   |   +-- pages/       # Route-level screens
|   |   +-- services/    # Axios API client
|   |   +-- utils/       # UI and formatting helpers
|   +-- vite.config.js
+-- docs/
+-- Documentation/
+-- scripts/
+-- render.yaml
```

## Main App Routes

Public routes:

- `/`
- `/login`
- `/register`

Protected routes:

- `/dashboard`
- `/wallet`
- `/payments`
- `/deposit`
- `/save`
- `/save/create`
- `/send`
- `/lipa-na-airsave`
- `/payments/paybill`
- `/activity`
- `/withdraw`
- `/settings`
- `/profile`
- `/admin`
- `/support`

Several legacy paths redirect to the current route names, including `/goals`, `/goals/new`, `/savings`, and `/transactions`.

## API Overview

The backend mounts these route groups:

- `/api/auth` - register, login, refresh, logout, current user, profile update, password change, password reset
- `/api/wallet` - wallet details, wallet deposit, wallet transaction history
- `/api/transactions` - payment initiation, send, buy goods, paybill, callbacks, status, activity, withdrawals, simulations
- `/api/goals` - create, list, active goal, update, delete
- `/api/analytics` - authenticated analytics summary
- `/api/notifications` - list notifications and mark notifications as read
- `/api/payments` - payment initiation
- `/api` - API health/status response

## Prerequisites

- Node.js 20 or newer
- npm
- MongoDB connection string, either local or hosted

## Local Development

Run the backend and frontend in separate terminals.

### Backend

```bash
cd backend
npm install
npm run dev
```

Create `backend/.env` from `backend/.env.example`:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/airsave
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRE=30d
JWT_REFRESH_EXPIRE=7d
CLIENT_URLS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174
RATE_LIMIT_WINDOW_MS=15m
RATE_LIMIT_MAX=100
```

The backend defaults to port `5000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Optional `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

In development, the frontend uses `VITE_API_BASE_URL` when present. Otherwise it falls back to `http://localhost:5000/api`.

## Available Scripts

### Frontend

```bash
npm run dev      # Start Vite dev server
npm run build    # Build production frontend
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

### Backend

```bash
npm run dev             # Start backend with nodemon
npm start               # Start backend with node
npm run build:frontend  # Install and build the frontend from backend script
npm run render-build    # Render build alias
```

Automated tests are not currently configured in either package.

## Authentication

AirSave uses JWT sessions with secure cookie support:

- Access and refresh tokens are issued after login/register
- Auth cookies are `httpOnly`
- Cookies use `sameSite: lax`
- Cookies use `secure: true` in production
- Protected API routes use the `protect` middleware
- The frontend also stores and sends a bearer token fallback for authenticated API calls
- Login and password-reset routes use rate limiting

## Production Deployment

The repository includes `render.yaml` for a Render web service:

```yaml
services:
  - type: web
    name: airsave
    runtime: node
    rootDir: backend
    buildCommand: npm install && npm run build:frontend
    startCommand: npm start
```

Required Render environment variables:

```env
NODE_ENV=production
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
```

Recommended production behavior:

- Build the frontend with the backend script
- Start the Express server from `backend`
- Open the backend Render URL as the app URL
- Use `/api` for same-origin API requests whenever the backend is serving `frontend/dist`

Current frontend API behavior:

- Development default: `http://localhost:5000/api`
- Production uses `VITE_API_BASE_URL` when set
- If `VITE_API_BASE_URL` is not set during production build, the current code falls back to the deployed Render API URL configured in `frontend/src/services/api.js`

For same-origin production deployment, set:

```env
VITE_API_BASE_URL=/api
```

## Build Output

The frontend production build is generated at:

```text
frontend/dist/index.html
```

When `NODE_ENV=production`, `backend/server.js` serves that build automatically if it exists.

## Notes for Contributors

- Keep API changes aligned across backend routes, controllers, and `frontend/src/services/api.js`
- Reuse existing React components before adding new UI primitives
- Keep financial flows clear, minimal, and mobile-friendly
- Avoid committing real `.env` files or secrets
- Prefer root-cause fixes over patching symptoms
