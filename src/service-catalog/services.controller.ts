import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateServiceDto } from './dto/create-service.dto';
import { ListServicesDto } from './dto/list-services.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServicesService } from './services.service';

type AuthenticatedRequest = Request & { user?: AuthenticatedPrincipal };

@Controller('services')
@ApiTags('Services')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateServiceDto) { return this.services.create(request.user!, dto); }

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query() query: ListServicesDto) { return this.services.list(request.user!, query); }

  @Get(':id')
  findOne(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.services.findOne(request.user!, id); }

  @Patch(':id')
  update(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateServiceDto) { return this.services.update(request.user!, id, dto); }

  @Post(':id/activate')
  activate(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.services.activate(request.user!, id); }

  @Post(':id/deactivate')
  deactivate(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.services.deactivate(request.user!, id); }
}
