import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { TrialRemindersCommand } from './trial-reminders.command';

@Controller('platform/trial-reminders') @ApiTags('Platform Trial Reminders') @ApiBearerAuth() @UseGuards(JwtAuthGuard, SuperAdminGuard)
export class TrialRemindersController {
  constructor(private readonly command: TrialRemindersCommand) {}

  @Post('process') @ApiOperation({ summary: 'Process due operational Trial Period reminders.' }) @ApiResponse({ status: 201, description: 'Due reminders processed idempotently.' })
  process() { return this.command.execute(); }
}
