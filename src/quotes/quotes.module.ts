import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({ imports: [PrismaModule, AuthModule], controllers: [QuotesController], providers: [QuotesService] })
export class QuotesModule {}
