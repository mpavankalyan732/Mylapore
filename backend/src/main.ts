import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true keeps the exact bytes needed for webhook signature verification
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.use(helmet());
  app.set('trust proxy', 1);
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','),
    allowedHeaders: ['Content-Type', 'Idempotency-Key', 'x-staff-key'],
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('Veg Restaurant API').setVersion('0.1.0').addApiKey({ type: 'apiKey', name: 'x-staff-key', in: 'header' }, 'staff').addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'agent').build(),
  );
  SwaggerModule.setup('docs', app, doc, { jsonDocumentUrl: 'docs/openapi.json' });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  new Logger('Bootstrap').log(`API on :${port}/api/v1  |  OpenAPI at /docs`);
}
bootstrap();
