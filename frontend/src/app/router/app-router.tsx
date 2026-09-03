import { Navigate, Route, Routes } from 'react-router-dom';
import { AppHomePage } from '../pages/app-home-page';
import { AppLayout } from '../layouts/app-layout';
import { PlatformLayout } from '../layouts/platform-layout';
import { ProtectedRoute } from '@/features/auth/components/protected-route';
import { LoginPage } from '@/features/auth/pages/login-page';
import { PlatformHomePage } from '../pages/platform-home-page';
import { useAuth, getHomePath } from '@/features/auth/auth-context';
import { NewQuotePage, QuoteDetailPage, QuotesListPage } from '@/features/quotes/pages/quote-pages';
import { NewWorkOrderPage, WorkOrderDetailPage, WorkOrdersListPage } from '@/features/work-orders/pages/work-order-pages';
import { CustomerDetailPage, CustomersListPage, EditCustomerPage, NewCustomerPage } from '@/features/customers/pages/customer-pages';
import { EditVehiclePage, NewVehiclePage, VehicleDetailPage, VehiclesListPage } from '@/features/vehicles/pages/vehicle-pages';
import { EditProductPage, NewProductPage, ProductDetailPage, ProductsListPage } from '@/features/products/pages/product-pages';
import { EditServicePage, NewServicePage, ServiceDetailPage, ServicesListPage } from '@/features/services/pages/service-pages';
import { ReportsPage } from '@/features/reports/pages/reports-page';
import { SettingsPage } from '@/features/settings/pages/settings-pages';
import { CommercialAccountDetailPage, CommercialAccountsListPage } from '@/features/platform/pages/commercial-account-pages';
import { OrganizationsListPage } from '@/features/platform/pages/organization-pages';
import { SubscriptionDetailPage, SubscriptionsListPage } from '@/features/platform/pages/subscription-pages';
import { NewSubscriptionChargePage, SubscriptionChargeDetailPage, SubscriptionChargesListPage } from '@/features/platform/pages/subscription-charge-pages';
import { PlanDetailPage, PlansListPage } from '@/features/platform/pages/plan-pages';
import { AuditEventsPage } from '@/features/platform/pages/audit-event-pages';
import { ProvisionCommercialAccountPage } from '@/features/platform/pages/provision-commercial-account-pages';
import { FinanceExpensePage, FinanceIndexPage, FinancePage } from '@/features/finance/pages/finance-page';
import { NewSupplierPage, SupplierDetailPage, SuppliersListPage } from '@/features/suppliers/pages/supplier-pages';

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
          <Route path="services/:id" element={<ServiceDetailPage />} />
          <Route path="suppliers" element={<SuppliersListPage />} />
          <Route path="suppliers/new" element={<NewSupplierPage />} />
          <Route path="suppliers/:id" element={<SupplierDetailPage />} />
          <Route path="finance" element={<FinanceIndexPage />} />
          <Route path="finance/work-orders/:workOrderId" element={<FinancePage />} />
          <Route path="finance/expenses/:expenseId" element={<FinanceExpensePage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} />}>
        <Route path="/platform" element={<PlatformLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<PlatformHomePage />} />
          <Route path="organizations" element={<OrganizationsListPage />} />
          <Route path="organizations/new" element={<ProvisionCommercialAccountPage />} />
          <Route path="commercial-accounts" element={<CommercialAccountsListPage />} />
          <Route path="commercial-accounts/:id" element={<CommercialAccountDetailPage />} />
          <Route path="subscriptions" element={<SubscriptionsListPage />} />
          <Route path="subscriptions/:id" element={<SubscriptionDetailPage />} />
          <Route path="charges" element={<SubscriptionChargesListPage />} />
          <Route path="charges/new" element={<NewSubscriptionChargePage />} />
          <Route path="charges/:id" element={<SubscriptionChargeDetailPage />} />
          <Route path="plans" element={<PlansListPage />} />
          <Route path="plans/:id" element={<PlanDetailPage />} />
          <Route path="audit-events" element={<AuditEventsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
