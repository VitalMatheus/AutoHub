import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DirectSalesController } from './direct-sales.controller';
import { DirectSalesService } from './direct-sales.service';
@Module({ imports: [PrismaModule, AuthModule], controllers: [DirectSalesController], providers: [DirectSalesService] })
export class DirectSalesModule {}
