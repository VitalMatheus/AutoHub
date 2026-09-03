import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateSupplierDto {
  @ApiProperty({ example: 'Distribuidora Auto Peças' })
  @IsString() @IsNotEmpty() @Length(1, 160) name!: string;
  @ApiPropertyOptional({ example: '12.345.678/0001-90', description: 'CPF/CNPJ; armazenado somente com dígitos.' })
  @IsOptional() @IsString() @Matches(/^(?:\d{11}|\d{14}|[\d.\-/]+)$/) document?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 40) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 2000) notes?: string;
}
