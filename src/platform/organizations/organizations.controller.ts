import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiNotFoundResponse, ApiOperation, ApiResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { CreateOrganizationDto, CreateOrganizationResponseDto } from './dto/create-organization.dto';
import { ListOrganizationsDto } from './dto/list-organizations.dto';
import { OrganizationResponseDto, OrganizationsResponseDto } from './dto/organization-response.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationTransitionDto } from './dto/organization-transition.dto';
import { OrganizationsService } from './organizations.service';
import type { Request } from 'express';
import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal';
import { RegularizeCommercialSetupDto } from './dto/regularize-commercial-setup.dto';

type AuthenticatedRequest = Request & { user?: AuthenticatedPrincipal };

@Controller('platform/organizations')
@ApiTags('Platform Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Post()
  @ApiResponse({ status: 201, type: CreateOrganizationResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid registration data.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'Super Admin access required.' })
  @ApiResponse({ status: 409, description: 'Organization or admin already exists.' })
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateOrganizationDto) { return this.organizations.create(request.user!, dto); }
  @Get() @ApiOperation({ summary: 'List enriched Organizations' }) @ApiResponse({ status: 200, type: OrganizationsResponseDto }) @ApiUnauthorizedResponse({ description: 'Authentication required.' }) @ApiForbiddenResponse({ description: 'Super Admin access required.' })
  list(@Query() dto: ListOrganizationsDto) { return this.organizations.list(dto); }
  @Get(':id') @ApiOperation({ summary: 'Inspect an enriched Organization' }) @ApiResponse({ status: 200, type: OrganizationResponseDto }) @ApiUnauthorizedResponse({ description: 'Authentication required.' }) @ApiForbiddenResponse({ description: 'Super Admin access required.' }) @ApiNotFoundResponse({ description: 'Organization not found.' })
  findOne(@Param('id') id: string) { return this.organizations.findOne(id); }
  @Post(':id/regularize-commercial-setup')
  @ApiOperation({ summary: 'Regularize an Organization pending commercial setup' })
  @ApiResponse({ status: 201, type: OrganizationResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid commercial configuration.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'Super Admin access required.' })
  @ApiNotFoundResponse({ description: 'Organization or current Subscription not found.' })
  @ApiResponse({ status: 409, description: 'Commercial setup is already configured with different values.' })
  regularizeCommercialSetup(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() dto: RegularizeCommercialSetupDto) {
    return this.organizations.regularizeCommercialSetup(request.user!, id, dto);
  }
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
