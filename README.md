#  AirSave — Smart Micro-Savings Platform

AirSave is a fullstack fintech-inspired application that helps users save money automatically through **round-up transactions** and **goal-based savings**.

It simulates a real-world **M-Pesa payment flow**, providing a realistic prototype for digital savings systems.

---

##  Live Demo

* **Frontend:** https://airsave-1.onrender.com
* **Backend API:** https://airsave-lg67.onrender.com/api

---

##  Core Concept

AirSave applies **behavioral finance principles**:

* Spend normally 
* Automatically round up transactions 
* Save the difference into goals 

Example:

```text
You spend: KES 47
Rounded to: KES 50
Saved: KES 3
```

---

##  Tech Stack

### Frontend

* React (Vite)
* React Router
* Axios
* Custom UI components

### Backend

* Node.js + Express
* MongoDB (Mongoose)
* JWT Authentication

### Architecture

* REST API
* Ledger-based transaction system
* Async payment simulation (M-Pesa mock)

---

##  Features

### ✅ Authentication

* User registration & login
* JWT-based protected routes

### 💰 Wallet System

* Tracks total savings
* Displays transaction count

### 🎯 Goals

* Create savings goals
* Track progress dynamically
* Goal-based saving allocation

### 💳 Payments (M-Pesa Simulation)

* Initiate payment
* Async confirmation (STK push simulation)
* Automatic savings calculation

### 📊 Transactions & Activity

* Ledger-backed transaction history
* Real-time activity updates

### 🔁 Smart Rounding Modes

* Light Saver → round to 10
* Balanced → round to 50
* Aggressive → round to 100

---

##  Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/your-username/airsave.git
cd airsave
```

---

### 2. Backend Setup

```bash
cd backend
npm install
```

Create `.env`:

```env
PORT=5000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_secret
```

Run:

```bash
npm run dev
```

---

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create `.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Run:

```bash
npm run dev
```

---

## 🧪 API Example

### Initiate Payment

```http
POST /api/payments/initiate
```

```json
{
  "amount": 47
}
```

Response:

```json
{
  "message": "Payment initiated",
  "rounded": 50,
  "savings": 3
}
```

---

##  Authentication

All protected routes require:

```http
Authorization: Bearer <token>
```

---

##  Known Behaviors

* Render free tier may cause **cold start delays (~30s)**
* SPA routing requires rewrite configuration (handled in deployment)

---

##  System Design Highlights

* **Ledger-based accounting** for data integrity
* **Async callback simulation** for payment realism
* **Separation of concerns** (frontend / backend / services)
* **Scalable architecture** for real fintech integration

---

## 🚀 Future Improvements

* Real M-Pesa API integration
* Withdrawal (B2C simulation)
* Notifications system
* Analytics dashboard
* Mobile responsiveness optimization

---

##  License

MIT License

---

##  Vision

AirSave is designed as a **real-world fintech prototype** demonstrating:

* Behavioral savings systems
* Payment lifecycle handling
* Scalable financial architecture

---

🔥 *Built to simulate real financial systems — not just a demo.*
