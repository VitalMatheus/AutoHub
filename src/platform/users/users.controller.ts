import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal';
import { InviteUserDto } from './dto/invite-user.dto';
import { UsersService } from './users.service';

type AuthenticatedRequest = Request & { user?: AuthenticatedPrincipal };

@Controller('organizations/users')
@ApiTags('Organization Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.users.list(request.user!);
  }

  @Post()
  invite(@Req() request: AuthenticatedRequest, @Body() dto: InviteUserDto) {
    return this.users.invite(request.user!, dto);
  }

  @Post(':id/deactivate')
  deactivate(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.users.setStatus(request.user!, id, 'DISABLED');
  }

  @Post(':id/activate')
  activate(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.users.setStatus(request.user!, id, 'ACTIVE');
  }

  @Post(':id/revoke-sessions')
  revokeSessions(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.users.revokeSessions(request.user!, id);
  }
}
