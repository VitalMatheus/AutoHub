import { Navigate, Route, Routes } from 'react-router-dom';
import { AppHomePage } from '../pages/app-home-page';
import { AppLayout } from '../layouts/app-layout';
import { ProtectedRoute } from '@/features/auth/components/protected-route';
import { LoginPage } from '@/features/auth/pages/login-page';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<AppHomePage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
