import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { environmentValidationSchema } from './config/env.validation';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './platform/organizations/organizations.module';
import { UsersModule } from './platform/users/users.module';
import { CustomersModule } from './customers/customers.module';
import { ServicesModule } from './service-catalog/services.module';
import { ProductsModule } from './products/products.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { QuotesModule } from './quotes/quotes.module';
import { WorkOrdersModule } from './work-orders/work-orders.module';
import { PaymentsModule } from './payments/payments.module';
import { SecurityLogger } from './common/security.logger';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuditEventsModule } from './platform/audit-events/audit-events.module';
import { PlansModule } from './platform/plans/plans.module';
import { CommercialAccountsModule } from './platform/commercial-accounts/commercial-accounts.module';
import { SubscriptionsModule } from './platform/subscriptions/subscriptions.module';
import { SubscriptionChargesModule } from './platform/subscription-charges/subscription-charges.module';
import { ExpensesModule } from './expenses/expenses.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { PurchasesModule } from './purchases/purchases.module';
import { DirectSalesModule } from './direct-sales/direct-sales.module';
import { ReportsModule } from './reports/reports.module';
import { CommonModule } from './common/common.module';
import { PublicRegistrationModule } from './public-registration/public-registration.module';
import { TrialModule } from './trial/trial.module';
import { ExportsModule } from './exports/exports.module';
import { PixCheckoutModule } from './platform/pix-checkout/pix-checkout.module';
import { AccountCancellationModule } from './platform/account-cancellation/account-cancellation.module';
import { AcquisitionFunnelModule } from './platform/acquisition-funnel/acquisition-funnel.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: environmentValidationSchema,
    }),
    PrismaModule,
    HealthModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
    AuthModule,
    OrganizationsModule,
    UsersModule,
    CustomersModule,
    ServicesModule,
    ProductsModule,
    VehiclesModule,
    QuotesModule,
    WorkOrdersModule,
    PaymentsModule,
    DashboardModule,
    AuditEventsModule,
    PlansModule,
    CommercialAccountsModule,
    SubscriptionsModule,
    SubscriptionChargesModule,
    ExpensesModule,
    SuppliersModule,
    PurchasesModule,
    DirectSalesModule,
    ReportsModule,
    CommonModule,
    PublicRegistrationModule,
    TrialModule,
    ExportsModule,
    PixCheckoutModule,
    AccountCancellationModule,
    AcquisitionFunnelModule,
  ],
  providers: [SecurityLogger],
  exports: [SecurityLogger],
})
export class AppModule {}
