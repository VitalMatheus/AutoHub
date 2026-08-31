import { Navigate, Route, Routes } from 'react-router-dom';
import { AppHomePage } from '../pages/app-home-page';
import { AppLayout } from '../layouts/app-layout';
import { PlatformLayout } from '../layouts/platform-layout';
import { ProtectedRoute } from '@/features/auth/components/protected-route';
import { LoginPage } from '@/features/auth/pages/login-page';
import { PlatformHomePage } from '../pages/platform-home-page';
import { useAuth, getHomePath } from '@/features/auth/auth-context';
import { FutureModulePage } from '../pages/future-module-page';
import { NewQuotePage, QuoteDetailPage, QuotesListPage } from '@/features/quotes/pages/quote-pages';
import { NewWorkOrderPage, WorkOrderDetailPage, WorkOrdersListPage } from '@/features/work-orders/pages/work-order-pages';
import { CustomerDetailPage, CustomersListPage, EditCustomerPage, NewCustomerPage } from '@/features/customers/pages/customer-pages';
import { EditVehiclePage, NewVehiclePage, VehicleDetailPage, VehiclesListPage } from '@/features/vehicles/pages/vehicle-pages';
import { EditProductPage, NewProductPage, ProductDetailPage, ProductsListPage } from '@/features/products/pages/product-pages';
import { EditServicePage, NewServicePage, ServicesListPage } from '@/features/services/pages/service-pages';

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
          <Route path="quotes" element={<QuotesListPage />} />
          <Route path="quotes/new" element={<NewQuotePage />} />
          <Route path="quotes/:id" element={<QuoteDetailPage />} />
          <Route path="work-orders" element={<WorkOrdersListPage />} />
          <Route path="work-orders/new" element={<NewWorkOrderPage />} />
          <Route path="work-orders/:id" element={<WorkOrderDetailPage />} />
          <Route path="products" element={<ProductsListPage />} />
          <Route path="products/new" element={<NewProductPage />} />
          <Route path="products/:id/edit" element={<EditProductPage />} />
          <Route path="products/:id" element={<ProductDetailPage />} />
          <Route path="services" element={<ServicesListPage />} />
          <Route path="services/new" element={<NewServicePage />} />
          <Route path="services/:id/edit" element={<EditServicePage />} />
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
