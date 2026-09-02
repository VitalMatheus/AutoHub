import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { CommercialAccountsController } from './commercial-accounts.controller';
import { CommercialAccountsService } from './commercial-accounts.service';

@Module({ imports: [AuthModule], controllers: [CommercialAccountsController], providers: [CommercialAccountsService] })
export class CommercialAccountsModule {}
