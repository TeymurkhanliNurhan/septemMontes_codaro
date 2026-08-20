import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../booking/entities/booking.entity';
import { BookingEvent } from './entities/booking-event.entity';
import { BookingEventController } from './booking-event.controller';
import { BookingEventService } from './booking-event.service';

@Module({
  imports: [TypeOrmModule.forFeature([BookingEvent, Booking])],
  controllers: [BookingEventController],
  providers: [BookingEventService],
  exports: [BookingEventService],
})
export class BookingEventModule {}
