import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { ListSuppliersDto } from './dto/list-suppliers.dto';
import { LinkProductSupplierDto } from './dto/link-product-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SuppliersService } from './suppliers.service';
type R = Request & { user?: AuthenticatedPrincipal };
@Controller() @ApiTags('Suppliers') @ApiBearerAuth() @UseGuards(JwtAuthGuard)
export class SuppliersController {
  constructor(private readonly service: SuppliersService) {}
  @Post('suppliers') create(@Req() r: R, @Body() dto: CreateSupplierDto) { return this.service.create(r.user!, dto); }
  @Get('suppliers') list(@Req() r: R, @Query() dto: ListSuppliersDto) { return this.service.list(r.user!, dto); }
  @Get('suppliers/:id') findOne(@Req() r: R, @Param('id') id: string) { return this.service.findOne(r.user!, id); }
  @Patch('suppliers/:id') update(@Req() r: R, @Param('id') id: string, @Body() dto: UpdateSupplierDto) { return this.service.update(r.user!, id, dto); }
  @Post('suppliers/:id/activate') activate(@Req() r: R, @Param('id') id: string) { return this.service.setActive(r.user!, id, true); }
  @Post('suppliers/:id/deactivate') deactivate(@Req() r: R, @Param('id') id: string) { return this.service.setActive(r.user!, id, false); }
  @Get('products/:productId/suppliers') listProduct(@Req() r: R, @Param('productId') id: string) { return this.service.listProductSuppliers(r.user!, id); }
  @Post('products/:productId/suppliers/:supplierId') link(@Req() r: R, @Param('productId') productId: string, @Param('supplierId') supplierId: string, @Body() dto: LinkProductSupplierDto) { return this.service.link(r.user!, productId, supplierId, dto); }
  @Patch('products/:productId/suppliers/:supplierId') updateLink(@Req() r: R, @Param('productId') productId: string, @Param('supplierId') supplierId: string, @Body() dto: LinkProductSupplierDto) { return this.service.link(r.user!, productId, supplierId, dto); }
  @Delete('products/:productId/suppliers/:supplierId') unlink(@Req() r: R, @Param('productId') productId: string, @Param('supplierId') supplierId: string) { return this.service.unlink(r.user!, productId, supplierId); }
}
