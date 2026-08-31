import { Navigate, Route, Routes } from 'react-router-dom';
import { AppHomePage } from '../pages/app-home-page';
import { AppLayout } from '../layouts/app-layout';
import { PlatformLayout } from '../layouts/platform-layout';
import { ProtectedRoute } from '@/features/auth/components/protected-route';
import { LoginPage } from '@/features/auth/pages/login-page';
import { PlatformHomePage } from '../pages/platform-home-page';
import { useAuth, getHomePath } from '@/features/auth/auth-context';
import { FutureModulePage } from '../pages/future-module-page';
import { CustomerDetailPage, CustomersListPage, EditCustomerPage, NewCustomerPage } from '@/features/customers/pages/customer-pages';
import { EditVehiclePage, NewVehiclePage, VehicleDetailPage, VehiclesListPage } from '@/features/vehicles/pages/vehicle-pages';

function HomeRedirect() {
  const { principal, isAuthenticated, isRestoring } = useAuth();
  if (isRestoring) return <div role="status" className="p-8 text-sm text-slate-600">Restaurando sessão…</div>;
  return <Navigate to={isAuthenticated && principal ? getHomePath(principal.role) : '/login'} replace />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AppHomePage />} />
          <Route path="customers" element={<CustomersListPage />} />
          <Route path="customers/new" element={<NewCustomerPage />} />
          <Route path="customers/:id/edit" element={<EditCustomerPage />} />
          <Route path="customers/:id" element={<CustomerDetailPage />} />
          <Route path="vehicles" element={<VehiclesListPage />} />
          <Route path="vehicles/new" element={<NewVehiclePage />} />
          <Route path="vehicles/:id/edit" element={<EditVehiclePage />} />
          <Route path="vehicles/:id" element={<VehicleDetailPage />} />
          <Route path="quotes/*" element={<FutureModulePage title="Orçamentos" />} />
          <Route path="work-orders/*" element={<FutureModulePage title="Ordens de Serviço" />} />
          <Route path="products/*" element={<FutureModulePage title="Produtos" />} />
          <Route path="services/*" element={<FutureModulePage title="Serviços" />} />
          <Route path="finance/*" element={<FutureModulePage title="Financeiro" />} />
          <Route path="reports/*" element={<FutureModulePage title="Relatórios" />} />
          <Route path="settings/*" element={<FutureModulePage title="Configurações" />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} />}>
        <Route path="/platform" element={<PlatformLayout />}>
          <Route index element={<PlatformHomePage />} />
        </Route>
      </Route>
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
