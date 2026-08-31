import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { ProductsService } from './products.service';

type AuthenticatedRequest = Request & { user?: AuthenticatedPrincipal };

@Controller('products')
@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateProductDto) { return this.products.create(request.user!, dto); }

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query() query: ListProductsDto) { return this.products.list(request.user!, query); }

  @Get(':id')
  findOne(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.products.findOne(request.user!, id); }

  @Patch(':id')
  update(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateProductDto) { return this.products.update(request.user!, id, dto); }

  @Post(':id/stock-adjustments')
  adjustStock(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() dto: AdjustStockDto) { return this.products.adjustStock(request.user!, id, dto); }

  @Post(':id/activate')
  activate(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.products.activate(request.user!, id); }

  @Post(':id/deactivate')
  deactivate(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.products.deactivate(request.user!, id); }
}
