import { Controller, Get, Header, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ManagerialReportQueryDto } from './dto/managerial-report-query.dto';
import { ManagerialReportResponseDto } from './dto/managerial-report-response.dto';
import { ReportsService } from './reports.service';
type AuthenticatedRequest = Request & { user?: AuthenticatedPrincipal };
@Controller('reports') @ApiTags('Reports') @ApiBearerAuth() @UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}
  @Get('managerial') @ApiOperation({ summary: 'Consultar DRE gerencial simplificada e resultado de caixa' }) @ApiOkResponse({ type: ManagerialReportResponseDto }) managerial(@Req() r: AuthenticatedRequest, @Query() q: ManagerialReportQueryDto) { return this.reports.managerial(r.user!, q); }
  @Get('managerial.csv') @Header('Content-Type', 'text/csv; charset=utf-8') @ApiProduces('text/csv') @ApiOperation({ summary: 'Exportar lançamentos realizados do relatório em CSV' }) async csv(@Req() r: AuthenticatedRequest, @Query() q: ManagerialReportQueryDto, @Res() response: Response) { response.setHeader('Content-Disposition', 'attachment; filename="vekar-relatorio.csv"'); return response.send(await this.reports.csv(r.user!, q)); }
}
