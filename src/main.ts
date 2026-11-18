import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN?.split(',').map((origin) => origin.trim()) ?? true,
    credentials: true,
  });

  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.useStaticAssets(join(process.cwd(), 'uploads', 'freelancer-profiles'), {
    prefix: '/uploads/freelancer-profiles/',
  });

  app.useStaticAssets(join(process.cwd(), 'uploads', 'projects'), {
    prefix: '/uploads/projects/',
  });

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
