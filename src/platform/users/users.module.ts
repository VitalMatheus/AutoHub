import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuditEventsModule } from '../audit-events/audit-events.module';

@Module({
  imports: [AuthModule, AuditEventsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
