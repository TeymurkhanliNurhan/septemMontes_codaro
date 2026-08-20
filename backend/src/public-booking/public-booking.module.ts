import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvailabilityException } from '../availability-exception/entities/availability-exception.entity';
import { AvailabilityRule } from '../availability-rule/entities/availability-rule.entity';
import { BookingResource } from '../booking-resource/entities/booking-resource.entity';
import { Organization } from '../organization/entities/organization.entity';
import { Resource } from '../resource/entities/resource.entity';
import { Service } from '../service/entities/service.entity';
import { ServiceResource } from '../service-resource/entities/service-resource.entity';
import { AvailabilityService } from './availability/availability.service';
import { PublicBookingService } from './booking/public-booking.service';
import { PublicBookingController } from './public-booking.controller';

@Module({
  imports: [
    // Only entities actually reached via @InjectRepository in this module.
    // PublicBookingService writes Booking, BookingEvent and Customer rows
    // too, but it does so entirely through DataSource.transaction's
    // EntityManager (see its constructor: `(availability, dataSource)`, no
    // repositories) -- that manager resolves against the app-wide entity
    // list from TypeOrmModule.forRootAsync in app.module.ts, not against
    // this module's forFeature. Registering those three here would imply an
    // injectable repository that doesn't exist; leave them out.
    TypeOrmModule.forFeature([
      Organization,
      Service,
      Resource,
      ServiceResource,
      AvailabilityRule,
      AvailabilityException,
      BookingResource,
    ]),
  ],
  controllers: [PublicBookingController],
  providers: [AvailabilityService, PublicBookingService],
})
export class PublicBookingModule {}
