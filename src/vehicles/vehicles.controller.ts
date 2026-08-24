import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { ListVehiclesDto } from './dto/list-vehicles.dto';
import { ListVehicleHistoryDto } from './dto/list-vehicle-history.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehiclesService } from './vehicles.service';

type AuthenticatedRequest = Request & { user?: AuthenticatedPrincipal };

@Controller('vehicles')
@ApiTags('Vehicles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateVehicleDto) { return this.vehicles.create(request.user!, dto); }

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query() query: ListVehiclesDto) { return this.vehicles.list(request.user!, query); }

  @Get(':id')
  findOne(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.vehicles.findOne(request.user!, id); }

  @Get(':id/work-orders')
  @ApiOperation({ summary: 'List completed and delivered Work Orders for a Vehicle' })
  @ApiOkResponse({ description: 'Paginated Vehicle service history derived from Work Orders.' })
  @ApiNotFoundResponse({ description: 'Vehicle is not in the authenticated Organization.' })
  history(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Query() query: ListVehicleHistoryDto) {
    return this.vehicles.history(request.user!, id, query);
  }

  @Patch(':id')
  update(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateVehicleDto) { return this.vehicles.update(request.user!, id, dto); }

  @Delete(':id')
  remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.vehicles.remove(request.user!, id); }
}
