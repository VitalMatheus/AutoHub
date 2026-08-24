import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersDto } from './dto/list-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomersService } from './customers.service';

type AuthenticatedRequest = Request & { user?: AuthenticatedPrincipal };

@Controller('customers')
@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateCustomerDto) { return this.customers.create(request.user!, dto); }

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query() query: ListCustomersDto) { return this.customers.list(request.user!, query); }

  @Get(':id')
  findOne(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.customers.findOne(request.user!, id); }

  @Patch(':id')
  update(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateCustomerDto) { return this.customers.update(request.user!, id, dto); }

  @Delete(':id')
  remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.customers.remove(request.user!, id); }
}
