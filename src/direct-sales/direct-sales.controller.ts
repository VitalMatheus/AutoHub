import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConfirmDirectSaleDto, CreateDirectSaleDto, SalePaymentDto, UpdateDirectSaleDto } from './dto/create-direct-sale.dto';
import { ListDirectSalesDto } from './dto/list-direct-sales.dto';
import { DirectSalesService } from './direct-sales.service';
type AuthenticatedRequest = Request & { user?: AuthenticatedPrincipal };
@Controller('direct-sales') @ApiTags('Direct Sales') @ApiBearerAuth() @UseGuards(JwtAuthGuard)
export class DirectSalesController {
  constructor(private readonly sales: DirectSalesService) {}
  @Post() create(@Req() r: AuthenticatedRequest, @Body() dto: CreateDirectSaleDto) { return this.sales.create(r.user!, dto); }
  @Get() list(@Req() r: AuthenticatedRequest, @Query() q: ListDirectSalesDto) { return this.sales.list(r.user!, q); }
  @Get(':id') findOne(@Req() r: AuthenticatedRequest, @Param('id') id: string) { return this.sales.findOne(r.user!, id); }
  @Patch(':id') update(@Req() r: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateDirectSaleDto) { return this.sales.update(r.user!, id, dto); }
  @Post(':id/confirm') confirm(@Req() r: AuthenticatedRequest, @Param('id') id: string, @Body() dto: ConfirmDirectSaleDto) { return this.sales.confirm(r.user!, id, dto); }
  @Post(':id/payments') addPayment(@Req() r: AuthenticatedRequest, @Param('id') id: string, @Body() dto: SalePaymentDto) { return this.sales.addPayment(r.user!, id, dto); }
  @Get(':id/receipt') receipt(@Req() r: AuthenticatedRequest, @Param('id') id: string) { return this.sales.receipt(r.user!, id); }
  @Post(':id/cancel') cancel(@Req() r: AuthenticatedRequest, @Param('id') id: string) { return this.sales.cancel(r.user!, id); }
}
