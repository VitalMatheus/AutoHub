import { ApiProperty } from '@nestjs/swagger';

class AmountsDto { @ApiProperty({ example: '100.00' }) total!: string; }
class CategoryAmountDto { @ApiProperty() category!: string; @ApiProperty({ example: '100.00' }) amount!: string; }
class ReceivableDto { @ApiProperty() source!: string; @ApiProperty() id!: string; @ApiProperty() number!: number; @ApiProperty() balance!: string; }
class PayableDto { @ApiProperty() id!: string; @ApiProperty() description!: string; @ApiProperty() category!: string; @ApiProperty() dueDate!: string; @ApiProperty() balance!: string; }

export class ManagerialReportResponseDto {
  @ApiProperty() from!: string; @ApiProperty() to!: string; @ApiProperty({ example: 'America/Recife' }) timezone!: string;
  @ApiProperty({ type: AmountsDto }) revenue!: { workOrders: string; directSales: string; total: string };
  @ApiProperty({ type: AmountsDto }) realizedExpenses!: { total: string; byCategory: CategoryAmountDto[] };
  @ApiProperty() cashResult!: string;
  @ApiProperty() grossProfit!: string;
  @ApiProperty() operatingProfit!: string;
  @ApiProperty() partsGrossMargin!: { sales: string; cost: string | null; margin: string | null; traceable: boolean };
  @ApiProperty({ type: [ReceivableDto] }) accountsReceivable!: ReceivableDto[];
  @ApiProperty({ type: [PayableDto] }) accountsPayable!: PayableDto[];
  @ApiProperty() monthlyComparison!: Array<{ month: string; revenue: string; expenses: string; cashResult: string }>;
}
