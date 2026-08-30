import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true });
  // Cloud Run injects PORT; default to 8080 to match its contract.
  await app.listen(process.env.PORT ?? 8080, '0.0.0.0');
}
void bootstrap();
