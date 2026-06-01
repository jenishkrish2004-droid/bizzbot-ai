import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../../contexts/AuthContext";

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <main className="app-surface flex min-h-screen items-center justify-center px-4 text-sm font-medium text-muted-foreground">
        <div className="glass-panel rounded-lg px-5 py-4">Loading workspace...</div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
