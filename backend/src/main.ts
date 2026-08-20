import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import {
  SessionConfig,
  SESSION_CONFIG_KEY,
} from './auth/config/session.config';

const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
];

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const session = configService.getOrThrow<SessionConfig>(SESSION_CONFIG_KEY);
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  app.use(cookieParser());

  const configured = configService.get<string>('CORS_ORIGINS');
  const allowedOrigins = configured
    ? configured
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : DEFAULT_DEV_ORIGINS;

  if (isProduction && !configured) {
    throw new Error('CORS_ORIGINS must be set in production');
  }

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('Septem Montes Booking API')
      .setDescription(
        'REST API for organizations, resources, availability, and bookings',
      )
      .setVersion('1.0')
      .addCookieAuth(
        session.cookieName,
        {
          type: 'apiKey',
          in: 'cookie',
          name: session.cookieName,
          description:
            'Set automatically by POST /auth/login. Swagger is same-origin, ' +
            'so "Try it out" works once you have logged in.',
        },
        'session',
      )
      .build();

    SwaggerModule.setup('api', app, SwaggerModule.createDocument(app, config));
  }

  await app.listen(process.env.PORT ?? 3005, '0.0.0.0');
}
void bootstrap();
