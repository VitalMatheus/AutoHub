import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../app.module';
import { AuthService } from './auth.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const config = app.get(ConfigService);
    const email = config.get<string>('SUPER_ADMIN_EMAIL');
    const password = config.get<string>('SUPER_ADMIN_PASSWORD');
    const name = config.get<string>('SUPER_ADMIN_NAME') ?? 'Super Admin';
    if (!email || !password) throw new Error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required');
    const user = await app.get(AuthService).bootstrapSuperAdmin(email, password, name);
    console.log(`Super Admin created: ${user.email}`);
  } finally { await app.close(); }
}

void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Bootstrap failed'); process.exitCode = 1; });
