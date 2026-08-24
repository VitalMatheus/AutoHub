import { IsString, Length, MinLength } from 'class-validator';

export class ActivateDto {
  @IsString() @MinLength(32)
  token!: string;

  @IsString() @Length(12, 128)
  password!: string;
}
