import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class UpdateOrganizationDto {
  @IsOptional() @IsString() @Length(1, 160)
  name?: string;
  @IsOptional() @IsString() document?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() addressLine1?: string;
  @IsOptional() @IsString() addressLine2?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() postalCode?: string;
}
