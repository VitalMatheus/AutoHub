import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AccountDashboardController, DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({ imports: [PrismaModule, AuthModule], controllers: [DashboardController, AccountDashboardController], providers: [DashboardService] })
export class DashboardModule {}
