import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEmail, IsOptional, IsString, IsNotEmpty, IsUUID, ValidateNested, Length } from 'class-validator';

export class FirstAdminDto {
  @IsString() @IsNotEmpty() @Length(1, 160)
  name!: string;

  @IsEmail() email!: string;
}

export class CreateOrganizationDto {
  @IsString() @IsNotEmpty() @Length(1, 160)
  name!: string;

  @IsOptional() @IsString() @Length(1, 30)
  document?: string;

  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() addressLine1?: string;
  @IsOptional() @IsString() addressLine2?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() postalCode?: string;

  @IsOptional() @ValidateNested() @Type(() => FirstAdminDto)
  admin?: FirstAdminDto;

  // Flat aliases keep the endpoint convenient for clients while `admin` remains
  // the canonical nested representation.
  @IsOptional() @IsString() @Length(1, 160)
  adminName?: string;

  @IsOptional() @IsEmail()
  adminEmail?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Published Plan Version selected by the Super Admin. Defaults to the current AutoHub Básico version.' })
  @IsOptional() @IsUUID()
  planVersionId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Existing Commercial Account to which this Organization is added.' })
  @IsOptional() @IsUUID()
  commercialAccountId?: string;

  @ApiPropertyOptional({ default: true, description: 'Whether the 14-day Trial Period is enabled.' })
  @IsOptional() @IsBoolean()
  trialEnabled?: boolean;

  @ApiPropertyOptional({ format: 'date-time', description: 'Explicitly authorized Trial Period start. Without it, the Trial starts at first admin activation.' })
  @IsOptional() @IsDateString()
  trialStartsAt?: string;
}

class ProvisionedOrganizationDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() operationalStatus!: string;
}

class ProvisionedAdminDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
  @ApiProperty() role!: string;
  @ApiProperty() status!: string;
}

class ProvisionedAccountDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() billingEmail?: string;
  @ApiPropertyOptional() billingDocument?: string;
  @ApiProperty() primaryContactOrganizationId!: string;
  @ApiProperty() primaryContactUserId!: string;
}

class ProvisionedSubscriptionDto {
  @ApiProperty() id!: string;
  @ApiProperty() planVersionId!: string;
  @ApiProperty() status!: string;
  @ApiProperty() trialEnabled!: boolean;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) trialStartsAt!: string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) trialEndsAt!: string | null;
  @ApiProperty() contractedPrice!: string;
}

export class CreateOrganizationResponseDto {
  @ApiProperty({ type: ProvisionedOrganizationDto }) organization!: ProvisionedOrganizationDto;
  @ApiProperty({ type: ProvisionedAccountDto }) commercialAccount!: ProvisionedAccountDto;
  @ApiProperty({ type: ProvisionedAdminDto }) admin!: ProvisionedAdminDto;
  @ApiProperty({ type: ProvisionedSubscriptionDto }) subscription!: ProvisionedSubscriptionDto;
  @ApiProperty() activationToken!: string;
}
