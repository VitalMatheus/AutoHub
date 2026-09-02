import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { CommercialAccountsService } from './commercial-accounts.service';
import { ListCommercialAccountsDto } from './dto/list-commercial-accounts.dto';

@Controller('platform/commercial-accounts')
@ApiTags('Platform Commercial Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class CommercialAccountsController {
  constructor(private readonly accounts: CommercialAccountsService) {}

  @Get() @ApiOperation({ summary: 'List Commercial Accounts and their Organizations' })
  @ApiOkResponse({ description: 'Commercial Accounts with their Organizations, subscription and Primary Contact.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'Super Admin access required.' })
  list(@Query() dto: ListCommercialAccountsDto) { return this.accounts.list(dto); }

  @Get(':id') @ApiOperation({ summary: 'Inspect a Commercial Account and its Organizations' })
  @ApiOkResponse({ description: 'Commercial Account details with its Organizations, subscription and Primary Contact.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'Super Admin access required.' })
  @ApiNotFoundResponse({ description: 'Commercial Account not found.' })
  detail(@Param('id') id: string) { return this.accounts.detail(id); }
}
