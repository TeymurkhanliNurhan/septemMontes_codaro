import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggerModule } from './common/logger/logger.module';
import { AuthModule } from './auth/auth.module';
import sessionConfig from './auth/config/session.config';
import { Session } from './auth/entities/session.entity';
import { SessionAuthGuard } from './auth/guards/session-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OrganizationModule } from './organization/organization.module';
import { UserModule } from './user/user.module';
import { CustomerModule } from './customer/customer.module';
import { ResourceModule } from './resource/resource.module';
import { ServiceModule } from './service/service.module';
import { AvailabilityRuleModule } from './availability-rule/availability-rule.module';
import { AvailabilityExceptionModule } from './availability-exception/availability-exception.module';
import { BookingModule } from './booking/booking.module';
import { BookingEventModule } from './booking-event/booking-event.module';
import { BookingParticipantModule } from './booking-participant/booking-participant.module';
import { BookingResourceModule } from './booking-resource/booking-resource.module';
import { ServiceResourceModule } from './service-resource/service-resource.module';
import { Organization } from './organization/entities/organization.entity';
import { User } from './user/entities/user.entity';
import { Customer } from './customer/entities/customer.entity';
import { Resource } from './resource/entities/resource.entity';
import { Service } from './service/entities/service.entity';
import { AvailabilityRule } from './availability-rule/entities/availability-rule.entity';
import { AvailabilityException } from './availability-exception/entities/availability-exception.entity';
import { Booking } from './booking/entities/booking.entity';
import { BookingEvent } from './booking-event/entities/booking-event.entity';
import { BookingParticipant } from './booking-participant/entities/booking-participant.entity';
import { BookingResource } from './booking-resource/entities/booking-resource.entity';
import { ServiceResource } from './service-resource/entities/service-resource.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [sessionConfig] }),
    LoggerModule,
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'default', ttl: 60_000, limit: 300 },
        { name: 'login', ttl: 60_000, limit: 10 },
      ],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: +(configService.get<string>('DB_PORT') || 5432),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_DATABASE', 'septem_montes'),
        entities: [
          Organization,
          Session,
          User,
          Customer,
          Resource,
          Service,
          AvailabilityRule,
          AvailabilityException,
          Booking,
          BookingEvent,
          BookingParticipant,
          BookingResource,
          ServiceResource,
        ],
        migrations: ['dist/src/migrations/*.js'],
        synchronize: configService.get<string>('SYNCHRONIZE') === 'true',
        logging: configService.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    AuthModule,
    OrganizationModule,
    UserModule,
    CustomerModule,
    ResourceModule,
    ServiceModule,
    AvailabilityRuleModule,
    AvailabilityExceptionModule,
    BookingModule,
    BookingEventModule,
    BookingParticipantModule,
    BookingResourceModule,
    ServiceResourceModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
