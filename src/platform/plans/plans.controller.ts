import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import type { Request } from 'express';
import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreatePlanVersionDto } from './dto/create-plan-version.dto';
import { ListPlansDto } from './dto/list-plans.dto';

type AuthenticatedRequest = Request & { user?: AuthenticatedPrincipal };
@Controller('platform/plans') @ApiTags('Platform Plans') @ApiBearerAuth() @UseGuards(JwtAuthGuard, SuperAdminGuard)
export class PlansController {
  constructor(private readonly plans: PlansService) {}
  @Get() list(@Query() dto: ListPlansDto) { return this.plans.list(dto); }
  @Post() create(@Req() req: AuthenticatedRequest, @Body() dto: CreatePlanDto) { return this.plans.create(req.user!, dto); }
  @Get(':id') detail(@Param('id') id: string) { return this.plans.detail(id); }
  @Patch(':id') update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: CreatePlanDto) { return this.plans.update(req.user!, id, dto); }
  @Post(':id/versions') createVersion(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: CreatePlanVersionDto) { return this.plans.createVersion(req.user!, id, dto); }
  @Patch(':id/versions/:versionId') updateVersion(@Req() req: AuthenticatedRequest, @Param('versionId') versionId: string, @Body() dto: CreatePlanVersionDto) { return this.plans.updateVersion(req.user!, versionId, dto); }
  @Post(':id/versions/:versionId/publish') publish(@Req() req: AuthenticatedRequest, @Param('versionId') versionId: string) { return this.plans.publish(req.user!, versionId); }
  @Delete(':id/versions/:versionId') deleteVersion(@Req() req: AuthenticatedRequest, @Param('versionId') versionId: string) { return this.plans.deleteVersion(req.user!, versionId); }
  @Post(':id/archive') archive(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.plans.archive(req.user!, id); }
}
