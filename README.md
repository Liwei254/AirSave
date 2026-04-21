#  AirSave

AirSave is a full-stack web application designed to help users track their savings, set financial goals, and monitor progress over time. It provides a simple and intuitive dashboard for managing personal finances.

---

## 🚀 Features

* 🔐 User Authentication (Register & Login with JWT)
* 💰 Savings Goals Management
* 📊 Dashboard with financial overview
* 🔄 Real-time data interaction between frontend and backend
* 🧩 Modular and scalable architecture

---

## 🛠️ Tech Stack

**Frontend**

* React (Vite)
* Axios
* Bootstrap / CSS

**Backend**

* Node.js
* Express.js
* MongoDB (Mongoose)
* JWT Authentication

---

## ⚙️ Backend Setup

1. Navigate to backend folder:

```
cd backend
```

2. Install dependencies:

```
npm install
```

3. Create a `.env` file:

```
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
```

4. Start the backend server:

```
npm run dev
```

👉 Server runs on: `http://localhost:5000`

---

## 💻 Frontend Setup

1. Navigate to frontend folder:

```
cd frontend
```

2. Install dependencies:

```
npm install
```

3. Start the frontend:

```
npm run dev
```

👉 App runs on: `http://localhost:5173`

---

## 🔗 API Connection

Ensure the frontend is configured to communicate with the backend:

Example (Axios base URL):

```js
http://localhost:5000/api
```

---

## 🧪 Testing

* Use Postman to test API endpoints:

  * `/api/auth/register`
  * `/api/auth/login`
  * `/api/goals`

---

## 📌 Notes

* Make sure MongoDB is running locally or use MongoDB Atlas
* Ensure backend is running before starting frontend
* JWT is used for protected routes

---


---

## 📄 License

This project is for educational and development purposes.
