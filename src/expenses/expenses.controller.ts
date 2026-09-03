import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/create-expense.dto';
import { CreateExpensePaymentDto } from './dto/create-expense-payment.dto';
import { ListExpensesDto } from './dto/list-expenses.dto';
import { ExpensesService } from './expenses.service';

type AuthenticatedRequest = Request & { user?: AuthenticatedPrincipal };
@Controller('expenses') @ApiTags('Expenses') @ApiBearerAuth() @UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}
  @Post() @ApiOperation({ summary: 'Cadastrar uma despesa' }) @ApiCreatedResponse({ description: 'Despesa cadastrada.' }) create(@Req() r: AuthenticatedRequest, @Body() dto: CreateExpenseDto) { return this.expenses.create(r.user!, dto); }
  @Get() @ApiOperation({ summary: 'Listar despesas com situação financeira e saldo' }) @ApiQuery({ type: ListExpensesDto }) @ApiOkResponse({ description: 'Despesas paginadas.' }) list(@Req() r: AuthenticatedRequest, @Query() query: ListExpensesDto) { return this.expenses.list(r.user!, query); }
  @Get(':id') @ApiOperation({ summary: 'Consultar uma despesa e seus pagamentos' }) @ApiNotFoundResponse() findOne(@Req() r: AuthenticatedRequest, @Param('id') id: string) { return this.expenses.findOne(r.user!, id); }
  @Patch(':id') @ApiOperation({ summary: 'Corrigir uma despesa sem baixa confirmada' }) @ApiConflictResponse({ description: 'Despesa já baixada ou cancelada.' }) update(@Req() r: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateExpenseDto) { return this.expenses.update(r.user!, id, dto); }
  @Post(':id/cancel') @ApiOperation({ summary: 'Cancelar uma despesa antes da quitação' }) @ApiConflictResponse({ description: 'Despesa com baixa confirmada não pode ser cancelada.' }) cancel(@Req() r: AuthenticatedRequest, @Param('id') id: string) { return this.expenses.cancel(r.user!, id); }
  @Post(':id/payments') @ApiOperation({ summary: 'Registrar baixa parcial ou integral' }) @ApiCreatedResponse({ description: 'Baixa registrada.' }) @ApiConflictResponse({ description: 'Valor excede o saldo ou há conflito de estado.' }) createPayment(@Req() r: AuthenticatedRequest, @Param('id') id: string, @Body() dto: CreateExpensePaymentDto) { return this.expenses.createPayment(r.user!, id, dto); }
  @Get(':id/payments') @ApiOperation({ summary: 'Listar baixas e saldo da despesa' }) listPayments(@Req() r: AuthenticatedRequest, @Param('id') id: string) { return this.expenses.listPayments(r.user!, id); }
  @Post(':id/payments/:paymentId/cancel') @ApiOperation({ summary: 'Reverter uma baixa preservando seu histórico' }) @ApiConflictResponse({ description: 'Baixa já revertida.' }) cancelPayment(@Req() r: AuthenticatedRequest, @Param('id') id: string, @Param('paymentId') paymentId: string) { return this.expenses.cancelPayment(r.user!, id, paymentId); }
}
