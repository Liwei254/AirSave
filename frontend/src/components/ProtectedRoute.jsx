import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { authEventName, getCurrentUser, hasStoredToken } from "../services/api";

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const [status, setStatus] = useState(() => (hasStoredToken() ? "loading" : "unauthenticated"));

  useEffect(() => {
    let active = true;

    async function verifySession() {
      if (!hasStoredToken()) {
        if (active) setStatus("unauthenticated");
        return;
      }

      try {
        const user = await getCurrentUser();
        if (active) {
          setStatus(user ? "authenticated" : "unauthenticated");
        }
      } catch {
        if (active) setStatus("unauthenticated");
      }
    }

    verifySession();
    return () => {
      active = false;
    };
  }, [location.pathname]);

  useEffect(() => {
    function handleAuthExpired() {
      setStatus("unauthenticated");
    }

    window.addEventListener(authEventName, handleAuthExpired);
    return () => window.removeEventListener(authEventName, handleAuthExpired);
  }, []);

  if (status === "loading") {
    return (
      <div className="loading-panel">
        <span className="spinner spinner-dark" aria-hidden="true" />
        <span>Checking your session...</span>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
