import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePurchaseDto, UpdatePurchaseDto } from './dto/create-purchase.dto';
import { ListPurchasesDto } from './dto/list-purchases.dto';
import { PurchasesService } from './purchases.service';
type AuthenticatedRequest = Request & { user?: AuthenticatedPrincipal };
@Controller('purchases') @ApiTags('Purchases') @ApiBearerAuth() @UseGuards(JwtAuthGuard)
export class PurchasesController { constructor(private readonly purchases: PurchasesService) {} @Post() create(@Req() r: AuthenticatedRequest, @Body() dto: CreatePurchaseDto) { return this.purchases.create(r.user!, dto); } @Get() list(@Req() r: AuthenticatedRequest, @Query() q: ListPurchasesDto) { return this.purchases.list(r.user!, q); } @Get(':id') findOne(@Req() r: AuthenticatedRequest, @Param('id') id: string) { return this.purchases.findOne(r.user!, id); } @Patch(':id') update(@Req() r: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdatePurchaseDto) { return this.purchases.update(r.user!, id, dto); } @Post(':id/confirm') confirm(@Req() r: AuthenticatedRequest, @Param('id') id: string) { return this.purchases.confirm(r.user!, id); } @Post(':id/cancel') cancel(@Req() r: AuthenticatedRequest, @Param('id') id: string) { return this.purchases.cancel(r.user!, id); } }
