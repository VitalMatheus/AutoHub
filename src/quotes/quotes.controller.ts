import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { CreateQuoteItemDto } from './dto/create-quote-item.dto';
import { ListQuotesDto } from './dto/list-quotes.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { UpdateQuoteItemDto } from './dto/update-quote-item.dto';
import { QuotesService } from './quotes.service';

type AuthenticatedRequest = Request & { user?: AuthenticatedPrincipal };

@Controller('quotes')
@ApiTags('Quotes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Post() create(@Req() request: AuthenticatedRequest, @Body() dto: CreateQuoteDto) { return this.quotes.create(request.user!, dto); }
  @Get() list(@Req() request: AuthenticatedRequest, @Query() query: ListQuotesDto) { return this.quotes.list(request.user!, query); }
  @Get(':id') findOne(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.quotes.findOne(request.user!, id); }
  @Patch(':id') update(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateQuoteDto) { return this.quotes.update(request.user!, id, dto); }
  @Post(':id/items') addItem(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() dto: CreateQuoteItemDto) { return this.quotes.addItem(request.user!, id, dto); }
  @Patch(':id/items/:itemId') updateItem(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Param('itemId') itemId: string, @Body() dto: UpdateQuoteItemDto) { return this.quotes.updateItem(request.user!, id, itemId, dto); }
  @Delete(':id/items/:itemId') removeItem(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Param('itemId') itemId: string) { return this.quotes.removeItem(request.user!, id, itemId); }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit a draft Quote for approval', description: 'Transitions DRAFT to PENDING.' })
  @ApiOkResponse({ description: 'Quote transitioned to PENDING.' })
  @ApiConflictResponse({ description: 'Quote is not in DRAFT (QUOTE_INVALID_TRANSITION).' })
  @ApiNotFoundResponse({ description: 'Quote is not in the authenticated Organization.' })
  submit(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.quotes.submit(request.user!, id); }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a pending Quote', description: 'Transitions PENDING to APPROVED. APPROVED is terminal.' })
  @ApiOkResponse({ description: 'Quote transitioned to APPROVED.' })
  @ApiConflictResponse({ description: 'Quote is not in PENDING (QUOTE_INVALID_TRANSITION).' })
  @ApiNotFoundResponse({ description: 'Quote is not in the authenticated Organization.' })
  approve(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.quotes.approve(request.user!, id); }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a pending Quote', description: 'Transitions PENDING to REJECTED. REJECTED is terminal.' })
  @ApiOkResponse({ description: 'Quote transitioned to REJECTED.' })
  @ApiConflictResponse({ description: 'Quote is not in PENDING (QUOTE_INVALID_TRANSITION).' })
  @ApiNotFoundResponse({ description: 'Quote is not in the authenticated Organization.' })
  reject(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.quotes.reject(request.user!, id); }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a Quote', description: 'Transitions DRAFT or PENDING to CANCELLED. CANCELLED is terminal.' })
  @ApiOkResponse({ description: 'Quote transitioned to CANCELLED.' })
  @ApiConflictResponse({ description: 'Quote cannot be cancelled from its current state (QUOTE_INVALID_TRANSITION).' })
  @ApiNotFoundResponse({ description: 'Quote is not in the authenticated Organization.' })
  cancel(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.quotes.cancel(request.user!, id); }
}
