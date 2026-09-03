import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationCommercialAccessFilter, OrganizationLifecycleFilter } from './list-organizations.dto';
import { FinancialStandingStatus } from '../../billing/financial-standing';

export class OrganizationFinancialStandingDto {
  @ApiProperty({ enum: FinancialStandingStatus }) status!: FinancialStandingStatus;
  @ApiProperty() dueToday!: boolean;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) dueDate!: string | null;
}

export class OrganizationResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() document!: string | null;
  @ApiPropertyOptional() email!: string | null;
  @ApiProperty() operationalStatus!: string;
  @ApiProperty({ type: OrganizationFinancialStandingDto }) financialStanding!: OrganizationFinancialStandingDto;
  @ApiProperty({ type: Object }) commercialAccount!: object | null;
  @ApiProperty({ type: Object, nullable: true }) primaryContact!: object | null;
  @ApiProperty({ type: Object, nullable: true }) plan!: object | null;
  @ApiProperty({ enum: OrganizationLifecycleFilter, isArray: true }) lifecycle!: OrganizationLifecycleFilter[];
  @ApiProperty({ type: Object }) conditions!: object;
  @ApiProperty({ enum: OrganizationCommercialAccessFilter }) commercialAccess!: OrganizationCommercialAccessFilter;
  @ApiProperty({ type: Object }) trial!: object;
  @ApiProperty({ type: Object }) commercialSetup!: object;
  @ApiProperty({ type: Object }) payment!: object;
  @ApiProperty({ type: Object }) effectiveAccess!: object;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) nextBillingDate!: string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) blockDate!: string | null;
  @ApiProperty({ enum: String, isArray: true }) administrativePending!: string[];
}

export class OrganizationsResponseDto {
  @ApiProperty({ type: OrganizationResponseDto, isArray: true }) data!: OrganizationResponseDto[];
  @ApiProperty({ type: Object }) meta!: object;
}
