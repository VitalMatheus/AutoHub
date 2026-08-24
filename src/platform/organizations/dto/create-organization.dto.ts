import { Type } from 'class-transformer';
import { IsEmail, IsOptional, IsString, IsNotEmpty, ValidateNested, Length } from 'class-validator';

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
}
