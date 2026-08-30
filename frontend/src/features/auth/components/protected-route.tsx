import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth-context';

export function ProtectedRoute() {
  const { isAuthenticated, isRestoring } = useAuth();
  const location = useLocation();
  if (isRestoring) return <div role="status" className="p-8 text-sm text-slate-600">Restaurando sessão…</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
