import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true });
  // A 100-page screenplay is ~150KB of text, and a base64-encoded PDF of one is
  // several MB. Express defaults to a 100KB limit.
  app.use(json({ limit: '32mb' }));
  // Cloud Run injects PORT; default to 8080 to match its contract.
  await app.listen(process.env.PORT ?? 8080, '0.0.0.0');
}
void bootstrap();
