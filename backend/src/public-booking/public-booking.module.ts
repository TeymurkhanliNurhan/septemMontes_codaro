import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvailabilityException } from '../availability-exception/entities/availability-exception.entity';
import { AvailabilityRule } from '../availability-rule/entities/availability-rule.entity';
import { Booking } from '../booking/entities/booking.entity';
import { BookingEvent } from '../booking-event/entities/booking-event.entity';
import { BookingResource } from '../booking-resource/entities/booking-resource.entity';
import { Customer } from '../customer/entities/customer.entity';
import { Organization } from '../organization/entities/organization.entity';
import { Resource } from '../resource/entities/resource.entity';
import { Service } from '../service/entities/service.entity';
import { ServiceResource } from '../service-resource/entities/service-resource.entity';
import { AvailabilityService } from './availability/availability.service';
import { PublicBookingService } from './booking/public-booking.service';
import { PublicBookingController } from './public-booking.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      Service,
      Resource,
      ServiceResource,
      AvailabilityRule,
      AvailabilityException,
      Booking,
      BookingResource,
      BookingEvent,
      Customer,
    ]),
  ],
  controllers: [PublicBookingController],
  providers: [AvailabilityService, PublicBookingService],
})
export class PublicBookingModule {}
