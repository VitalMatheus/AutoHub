import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApplication } from './bootstrap';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  configureApplication(app);
  const config = app.get(ConfigService);

  await app.listen(config.getOrThrow<number>('PORT'));
}

void bootstrap();
