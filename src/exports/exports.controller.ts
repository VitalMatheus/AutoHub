import { Controller, Get, Param, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExportsService } from './exports.service';

type AuthenticatedRequest = Request & { user?: AuthenticatedPrincipal };

@Controller()
@ApiTags('Exports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

  @Get('exports/:resource.csv')
  @ApiProduces('text/csv')
  @ApiOperation({ summary: 'Export tenant-owned tabular records as CSV.' })
  async csv(@Req() request: AuthenticatedRequest, @Param('resource') resource: string, @Res() response: Response) {
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="autohub-${resource}.csv"`);
    return response.send(await this.exports.csv(request.user!, resource));
  }

  @Get('quotes/:id.pdf')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Export a Quote belonging to the authenticated Organization as PDF.' })
  async quote(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Res() response: Response) {
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="autohub-quote-${id}.pdf"`);
    return response.send(await this.exports.quotePdf(request.user!, id));
  }

  @Get('work-orders/:id.pdf')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Export a Work Order belonging to the authenticated Organization as PDF.' })
  async workOrder(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Res() response: Response) {
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="autohub-work-order-${id}.pdf"`);
    return response.send(await this.exports.workOrderPdf(request.user!, id));
  }
}
