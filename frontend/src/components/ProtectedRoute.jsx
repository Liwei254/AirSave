import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useProfileQuery } from "../api/hooks";
import { authEventName, hasStoredToken } from "../services/api";

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const [sessionExpired, setSessionExpired] = useState(false);
  const hasToken = hasStoredToken();
  const {
    data: user,
    isError,
    isLoading,
  } = useProfileQuery({
    enabled: hasToken && !sessionExpired,
    retry: false,
  });

  useEffect(() => {
    function handleAuthExpired() {
      setSessionExpired(true);
    }

    window.addEventListener(authEventName, handleAuthExpired);
    return () => window.removeEventListener(authEventName, handleAuthExpired);
  }, []);

  if (hasToken && !sessionExpired && isLoading) {
    return (
      <div className="loading-panel">
        <span className="spinner spinner-dark" aria-hidden="true" />
        <span>Checking your session...</span>
      </div>
    );
  }

  if (!hasToken || sessionExpired || isError || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
