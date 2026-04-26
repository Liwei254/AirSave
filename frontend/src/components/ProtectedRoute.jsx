import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getCurrentUser } from "../services/api";

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let active = true;

    async function verifySession() {
      try {
        await getCurrentUser();
        if (active) setStatus("authenticated");
      } catch {
        if (active) setStatus("unauthenticated");
      }
    }

    verifySession();
    return () => {
      active = false;
    };
  }, [location.pathname]);

  if (status === "loading") {
    return (
      <div className="loading-panel">
        <span className="spinner spinner-dark" aria-hidden="true" />
        <span>Checking your session...</span>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return children;
}
