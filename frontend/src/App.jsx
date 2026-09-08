import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Payments from "./pages/Payments.jsx";
import Deposit from "./pages/Deposit.jsx";
import Send from "./pages/Send.jsx";
import LipaNaAirSave from "./pages/LipaNaAirSave.jsx";
import Airtime from "./pages/Airtime.jsx";
import Paybill from "./pages/Paybill.jsx";
import Goals from "./pages/Goals.jsx";
import GoalNew from "./pages/GoalNew.jsx";
import AddSavings from "./pages/AddSavings.jsx";
import Transactions from "./pages/Transactions.jsx";
import Withdraw from "./pages/Withdraw.jsx";
import Wallet from "./pages/Wallet.jsx";
import Settings from "./pages/Settings.jsx";
import Profile from "./pages/Profile.jsx";
import Support from "./pages/Support.jsx";
import Admin from "./pages/Admin.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AuthNavbar from "./components/AuthNavbar.jsx";
import Footer from "./components/Footer.jsx";

function App() {
  return (
    <BrowserRouter>
      <div className="d-flex flex-column min-vh-100">
        <AuthNavbar />
        <div className="flex-grow-1">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
            <Route path="/wallet/buy-goods" element={<Navigate to="/lipa-na-airsave" replace />} />
            <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
            <Route path="/deposit" element={<ProtectedRoute><Deposit /></ProtectedRoute>} />
            <Route path="/save" element={<ProtectedRoute><Goals /></ProtectedRoute>} />
            <Route path="/save/create" element={<ProtectedRoute><GoalNew /></ProtectedRoute>} />
            <Route path="/save/add" element={<ProtectedRoute><AddSavings /></ProtectedRoute>} />
            <Route path="/save/create-goal" element={<Navigate to="/save/create" replace />} />
            <Route path="/send" element={<ProtectedRoute><Send /></ProtectedRoute>} />
            <Route path="/lipa-na-airsave" element={<ProtectedRoute><LipaNaAirSave /></ProtectedRoute>} />
            <Route path="/payments/buy-goods" element={<Navigate to="/lipa-na-airsave" replace />} />
            <Route path="/airtime" element={<ProtectedRoute><Airtime /></ProtectedRoute>} />
            <Route path="/payments/airtime" element={<Navigate to="/airtime" replace />} />
            <Route path="/payments/paybill" element={<ProtectedRoute><Paybill /></ProtectedRoute>} />
            <Route path="/goals" element={<Navigate to="/save" replace />} />
            <Route path="/goals/new" element={<Navigate to="/save/create" replace />} />
            <Route path="/activity" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
            <Route path="/withdraw" element={<ProtectedRoute><Withdraw /></ProtectedRoute>} />
            <Route path="/savings" element={<Navigate to="/save" replace />} />
            <Route path="/transactions" element={<Navigate to="/activity" replace />} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
