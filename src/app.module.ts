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
  ],
  providers: [SecurityLogger],
  exports: [SecurityLogger],
})
export class AppModule {}
