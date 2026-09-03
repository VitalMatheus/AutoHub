import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { CreateWorkOrderItemDto } from './dto/create-work-order-item.dto';
import { ListWorkOrdersDto } from './dto/list-work-orders.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';
import { UpdateWorkOrderItemDto } from './dto/update-work-order-item.dto';
import { CompleteWorkOrderDto } from './dto/complete-work-order.dto';
import { WorkOrdersService } from './work-orders.service';

type AuthenticatedRequest = Request & { user?: AuthenticatedPrincipal };

@Controller('work-orders') @ApiTags('Work Orders') @ApiBearerAuth() @UseGuards(JwtAuthGuard)
export class WorkOrdersController {
  constructor(private readonly workOrders: WorkOrdersService) {}
  @Post() @ApiCreatedResponse({ description: 'Work Order created.' }) create(@Req() r: AuthenticatedRequest, @Body() dto: CreateWorkOrderDto) { return this.workOrders.create(r.user!, dto); }
  @Post('from-quote/:quoteId')
  @ApiOperation({ summary: 'Convert an approved Quote into a Work Order' })
  @ApiCreatedResponse({ description: 'Work Order created.' })
  @ApiConflictResponse({ description: 'Quote is not approved or was already converted.' })
  @ApiNotFoundResponse({ description: 'Quote is not in the authenticated Organization.' })
  convertFromQuote(@Req() r: AuthenticatedRequest, @Param('quoteId') quoteId: string) { return this.workOrders.convertApprovedQuote(r.user!, quoteId); }
  @Get('financial') @ApiOperation({ summary: 'List Work Orders with their financial state' }) @ApiOkResponse({ description: 'Financial Work Orders listed.' }) listFinancial(@Req() r: AuthenticatedRequest, @Query() q: ListWorkOrdersDto) { return this.workOrders.listFinancial(r.user!, q); }
  @Get() @ApiOkResponse({ description: 'Work Orders listed.' }) list(@Req() r: AuthenticatedRequest, @Query() q: ListWorkOrdersDto) { return this.workOrders.list(r.user!, q); }
  @Get(':id') @ApiOkResponse({ description: 'Work Order returned.' }) findOne(@Req() r: AuthenticatedRequest, @Param('id') id: string) { return this.workOrders.findOne(r.user!, id); }
  @Patch(':id') @ApiOkResponse({ description: 'Work Order updated.' }) update(@Req() r: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateWorkOrderDto) { return this.workOrders.update(r.user!, id, dto); }
  @Post(':id/items') @ApiCreatedResponse({ description: 'Work Order item added.' }) addItem(@Req() r: AuthenticatedRequest, @Param('id') id: string, @Body() dto: CreateWorkOrderItemDto) { return this.workOrders.addItem(r.user!, id, dto); }
  @Patch(':id/items/:itemId') @ApiOkResponse({ description: 'Work Order item updated.' }) updateItem(@Req() r: AuthenticatedRequest, @Param('id') id: string, @Param('itemId') itemId: string, @Body() dto: UpdateWorkOrderItemDto) { return this.workOrders.updateItem(r.user!, id, itemId, dto); }
  @Delete(':id/items/:itemId') @ApiOkResponse({ description: 'Work Order item removed.' }) removeItem(@Req() r: AuthenticatedRequest, @Param('id') id: string, @Param('itemId') itemId: string) { return this.workOrders.removeItem(r.user!, id, itemId); }

  @Post(':id/request-approval') @ApiCreatedResponse({ description: 'Work Order transitioned.' }) @ApiOperation({ summary: 'Move an OPEN Work Order to WAITING_APPROVAL' }) @ApiConflictResponse({ description: 'WORK_ORDER_INVALID_TRANSITION' }) @ApiNotFoundResponse() requestApproval(@Req() r: AuthenticatedRequest, @Param('id') id: string) { return this.workOrders.requestApproval(r.user!, id); }
  @Post(':id/start') @ApiCreatedResponse({ description: 'Work Order transitioned.' }) start(@Req() r: AuthenticatedRequest, @Param('id') id: string) { return this.workOrders.start(r.user!, id); }
  @Post(':id/wait-parts') @ApiCreatedResponse({ description: 'Work Order transitioned.' }) waitParts(@Req() r: AuthenticatedRequest, @Param('id') id: string) { return this.workOrders.waitParts(r.user!, id); }
  @Post(':id/complete') @ApiCreatedResponse({ description: 'Work Order transitioned and stock consumed.' }) complete(@Req() r: AuthenticatedRequest, @Param('id') id: string, @Body() dto: CompleteWorkOrderDto) { return this.workOrders.complete(r.user!, id, dto); }
  @Post(':id/deliver') @ApiCreatedResponse({ description: 'Work Order transitioned.' }) deliver(@Req() r: AuthenticatedRequest, @Param('id') id: string) { return this.workOrders.deliver(r.user!, id); }
  @Post(':id/cancel') @ApiCreatedResponse({ description: 'Work Order transitioned.' }) cancel(@Req() r: AuthenticatedRequest, @Param('id') id: string) { return this.workOrders.cancel(r.user!, id); }
}
