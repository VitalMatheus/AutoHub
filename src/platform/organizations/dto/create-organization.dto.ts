import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDefined, IsEmail, IsOptional, IsString, IsNotEmpty, ValidateNested, Length, Matches, IsInt, Min, Max } from 'class-validator';

export class FirstAdminDto {
  @ApiProperty()
  @IsString() @IsNotEmpty() @Length(1, 160)
  name!: string;

  @ApiProperty({ format: 'email' })
  @IsEmail() email!: string;
}

export class CreateOrganizationDto {
  @ApiProperty()
  @IsString() @IsNotEmpty() @Length(1, 160)
  name!: string;

  @IsOptional() @IsString() @Length(1, 30)
  document?: string;

  @ApiProperty()
  @IsString() @IsNotEmpty() @Length(1, 30)
  phone!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() addressLine1?: string;
  @IsOptional() @IsString() addressLine2?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() notes?: string;

  @ApiProperty({ type: FirstAdminDto })
  @IsDefined() @ValidateNested() @Type(() => FirstAdminDto)
  admin!: FirstAdminDto;

  @ApiPropertyOptional({ type: 'string', default: '79.00', pattern: '^\\d+\\.\\d{2}$' })
  @IsOptional() @Matches(/^\d+\.\d{2}$/)
  contractedPrice?: string;

  @ApiProperty({ type: 'string', format: 'date', example: '2026-10-10' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  firstDueDate!: string;

  @ApiProperty({ minimum: 1, maximum: 28, example: 10 })
  @Type(() => Number) @IsInt() @Min(1) @Max(28)
  billingDay!: number;
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

export class CreateOrganizationResponseDto {
  @ApiProperty({ type: ProvisionedOrganizationDto }) organization!: ProvisionedOrganizationDto;
  @ApiProperty({ type: ProvisionedAdminDto }) admin!: ProvisionedAdminDto;
  @ApiProperty({ description: 'One-time activation secret. It is never persisted or audited.', minLength: 32, writeOnly: true }) activationSecret!: string;
}
