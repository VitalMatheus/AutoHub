import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService } from './organizations.service';

@Controller('platform/organizations')
@ApiTags('Platform Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Post() create(@Body() dto: CreateOrganizationDto) { return this.organizations.create(dto); }
  @Get() list(@Query('page', new ParseIntPipe({ optional: true })) page?: number, @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number) { return this.organizations.list(page, pageSize); }
  @Get(':id') findOne(@Param('id') id: string) { return this.organizations.findOne(id); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) { return this.organizations.update(id, dto); }
  @Post(':id/activate') activate(@Param('id') id: string) { return this.organizations.setActive(id, true); }
  @Post(':id/deactivate') deactivate(@Param('id') id: string) { return this.organizations.setActive(id, false); }
}
