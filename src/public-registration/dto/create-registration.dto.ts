import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Equals, IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
import { IsCpfCnpj } from '../cpf-cnpj.validator';

export class CreateRegistrationDto {
  @ApiProperty({ description: 'Nome da oficina.' }) @IsString() @IsNotEmpty() @Length(1, 160) workshopName!: string;
  @ApiProperty({ example: '12.345.678/0001-90' }) @IsString() @IsNotEmpty() @IsCpfCnpj() document!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @Length(8, 30) phone!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @Length(1, 160) responsibleName!: string;
  @ApiProperty({ format: 'email' }) @IsEmail() email!: string;
  @ApiProperty({ minLength: 12, maxLength: 128, writeOnly: true }) @IsString() @Length(12, 128) password!: string;
  @ApiProperty({ description: 'Aceite obrigatório dos Termos de Uso.' }) @IsBoolean() @Equals(true) termsAccepted!: boolean;
  @ApiProperty({ description: 'Aceite obrigatório da Política de Privacidade.' }) @IsBoolean() @Equals(true) privacyAccepted!: boolean;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() marketingConsent?: boolean;
  @ApiPropertyOptional({ writeOnly: true, description: 'Token Turnstile quando a política de tráfego suspeito exigir verificação.' }) @IsOptional() @IsString() turnstileToken?: string;
}

export class RegistrationAcceptedResponseDto {
  @ApiProperty({ example: 'Se os dados puderem iniciar um cadastro, enviaremos instruções para o e-mail informado.' }) message!: string;
}
