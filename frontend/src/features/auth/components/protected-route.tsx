import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getHomePath, useAuth } from '../auth-context';
import type { UserRole } from '@/shared/types/auth';

type ProtectedRouteProps = { allowedRoles?: UserRole[] };

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { principal, isAuthenticated, isRestoring } = useAuth();
  const location = useLocation();
  if (isRestoring) return <div role="status" className="p-8 text-sm text-slate-600">Restaurando sessão…</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (allowedRoles && principal && !allowedRoles.includes(principal.role)) return <Navigate to={getHomePath(principal.role)} replace />;
  return <Outlet />;
}
