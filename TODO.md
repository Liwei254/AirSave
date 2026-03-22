# AirSave Development TODO

## STEP 1: Backend Setup ✅
- [x] Create TODO.md
- [x] Update backend/package.json (deps, scripts)
- [x] Create folder structure (config, controllers, models, routes, services, middlewares, utils)
- [x] Create backend/server.js (Express app setup)
- [x] Create backend/.env.example
- [x] Create backend/config/db.js (MongoDB connect)
- [x] Install deps (completed)
- [x] Test server (npm run dev) - verified (needs .env/MongoDB)

## STEP 2: Core Models ✅
- [x] Create User model
- [x] Create Wallet model  
- [x] Create Ledger model (critical - no direct balance)
- [x] Create Transaction model
- [x] Create Goal model

## STEP 3: Auth Module ✅
- [x] Create utils/jwt.js
- [x] Create middlewares/auth.js (JWT verify, RBAC)
- [x] Create controllers/authController.js (register/login)
- [x] Create routes/auth.js

## STEP 4: Route Integration & Validation (Next)
- [ ] Update server.js to mount routes
- [ ] Create validation middleware utils

## Future Steps
- STEP 2: Core models & controllers
- STEP 3: Auth module
- ... (full modules per plan)

Updated when steps complete.
