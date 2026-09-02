import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class AuthTokensResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  @ApiProperty({ example: 900, description: 'Access token lifetime in seconds.' })
  expiresIn!: number;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;
}

export class AuthenticatedPrincipalResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Ana Souza' })
  name!: string;

  @ApiProperty({ example: 'ana@example.com' })
  email!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.ADMIN })
  role!: UserRole;

  @ApiProperty({ format: 'uuid', nullable: true })
  organizationId!: string | null;
}

export class SuccessResponseDto {
  @ApiProperty({ example: true })
  success!: true;
}
