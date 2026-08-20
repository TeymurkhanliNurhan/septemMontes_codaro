import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { AppModule } from './app.module';
import {
  SessionConfig,
  SESSION_CONFIG_KEY,
} from './auth/config/session.config';
import { AppLogger } from './common/logger/app-logger.service';
import { getLogDirectory } from './common/logger/winston.config';

const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
  'http://localhost:3005',
];

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const configService = app.get(ConfigService);
  const session = configService.getOrThrow<SessionConfig>(SESSION_CONFIG_KEY);
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  const logger = await app.resolve(AppLogger);
  logger.setContext('Bootstrap');
  app.useLogger(logger);

  app.use(cookieParser());
  app.useStaticAssets(join(__dirname, '..', 'public'));

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
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Paste accessToken from POST /auth/login into Authorize.',
        },
        'JWT-auth',
      )
      .addCookieAuth(
        session.cookieName,
        {
          type: 'apiKey',
          in: 'cookie',
          name: session.cookieName,
          description:
            'Set automatically by POST /auth/login. Swagger is same-origin, ' +
            'so "Try it out" also works via cookie after login.',
        },
        'session',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    document.security = [{ 'JWT-auth': [] }, { session: [] }];
    SwaggerModule.setup('api', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tryItOutEnabled: true,
        displayRequestDuration: true,
        docExpansion: 'list',
        filter: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
      customSiteTitle: 'Septem Montes API',
    });
  }

  const port = process.env.PORT ?? 3005;
  await app.listen(port, '0.0.0.0');
  logger.log(`Application listening on http://localhost:${port}`);
  logger.log(`Swagger docs at http://localhost:${port}/api`);
  logger.log(`Daily log files in ${getLogDirectory()}`);
}
void bootstrap();
