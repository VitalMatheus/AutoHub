import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TrialRemindersService } from './trial-reminders.service';
import { AuthModule } from '../auth/auth.module';
import { TrialRemindersCommand } from './trial-reminders.command';
import { TrialRemindersController } from './trial-reminders.controller';

@Module({ imports: [CommonModule, PrismaModule, AuthModule], controllers: [TrialRemindersController], providers: [TrialRemindersService, TrialRemindersCommand], exports: [TrialRemindersService] })
export class TrialModule {}
