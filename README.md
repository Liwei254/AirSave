# AirSave

AirSave is a full-stack fintech savings application built with React, Vite, Express, and MongoDB.

## Production deployment

Production should run as a single same-origin app:
- Express serves the API under `/api`
- Express serves the built frontend from `frontend/dist`
- Authentication uses HTTP-only cookies on the same origin, so third-party cookies are not required

Recommended Render setup:
- Service type: `Web Service`
- Root directory: `backend`
- Build command: `npm install && npm run build:frontend`
- Start command: `npm start`

Required backend environment variables:

```env
NODE_ENV=production
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
```

Open the app from the backend Render URL after deployment. Example:
- App + API origin: `https://your-backend-service.onrender.com`
- API health: `https://your-backend-service.onrender.com/api`

## Local development

Local development still runs frontend and backend separately.

### Backend

```bash
cd backend
npm install
npm run dev
```

Create `backend/.env`:

```env
PORT=5000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:5173
```

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

Behavior:
- In development, the frontend calls `VITE_API_BASE_URL` or `http://localhost:5000/api`
- In production, the frontend automatically uses the same-origin relative API path `/api`

## Authentication

AirSave uses cookie-based authentication:
- `httpOnly: true`
- `secure: true` in production
- `sameSite: lax`
- `path: /`

Expected production flow:
1. User logs in from the backend-served app URL
2. Backend sets auth cookies on the same origin
3. `/api/auth/me` returns `200`
4. Protected routes and notifications reuse the same session

## Build output

Frontend production build output is generated at:
- `frontend/dist/index.html`

The backend serves that build automatically in production.
