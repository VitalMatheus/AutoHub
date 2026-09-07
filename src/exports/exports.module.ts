import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

@Module({ imports: [PrismaModule, AuthModule], controllers: [ExportsController], providers: [ExportsService] })
export class ExportsModule {}
