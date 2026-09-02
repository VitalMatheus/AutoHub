import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationTransitionDto } from './dto/organization-transition.dto';
import { OrganizationsService } from './organizations.service';
import type { Request } from 'express';
import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal';

type AuthenticatedRequest = Request & { user?: AuthenticatedPrincipal };

@Controller('platform/organizations')
@ApiTags('Platform Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Post() create(@Req() request: AuthenticatedRequest, @Body() dto: CreateOrganizationDto) { return this.organizations.create(request.user!, dto); }
  @Get() list(@Query('page', new ParseIntPipe({ optional: true })) page?: number, @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number) { return this.organizations.list(page, pageSize); }
  @Get(':id') findOne(@Param('id') id: string) { return this.organizations.findOne(id); }
  @Patch(':id') update(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateOrganizationDto) { return this.organizations.update(request.user!, id, dto); }
  @Post(':id/activate') @ApiOperation({ summary: 'Activate an Organization' }) @ApiResponse({ status: 409, description: 'Invalid operational transition.' })
  activate(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.organizations.transition(request.user!, id, 'activate'); }
  @Post(':id/deactivate') @ApiOperation({ summary: 'Deactivate an Organization' }) @ApiResponse({ status: 409, description: 'Invalid operational transition.' })
  deactivate(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() dto: OrganizationTransitionDto) { return this.organizations.transition(request.user!, id, 'deactivate', dto); }
  @Post(':id/suspend') @ApiOperation({ summary: 'Suspend an Organization' }) @ApiResponse({ status: 409, description: 'Invalid operational transition.' })
  suspend(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() dto: OrganizationTransitionDto) { return this.organizations.transition(request.user!, id, 'suspend', dto); }
  @Post(':id/reactivate') @ApiOperation({ summary: 'Reactivate an Organization' }) @ApiResponse({ status: 409, description: 'Invalid operational transition.' })
  reactivate(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.organizations.transition(request.user!, id, 'reactivate'); }
}
