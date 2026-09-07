import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { JwtModuleOptions } from '@nestjs/jwt';
import { AccountController, AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    CommonModule,
    JwtModule.registerAsync({ useFactory: (config: ConfigService): JwtModuleOptions => ({
      secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      signOptions: { expiresIn: '15m' },
    }), inject: [ConfigService] }),
  ],
  controllers: [AuthController, AccountController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
