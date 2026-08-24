import { IsEmail, IsString, IsNotEmpty, Length } from 'class-validator';

export class InviteUserDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 160)
  name!: string;

  @IsEmail()
  email!: string;
}
