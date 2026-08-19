import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingParticipant } from './entities/booking-participant.entity';
import { BookingParticipantController } from './booking-participant.controller';
import { BookingParticipantService } from './booking-participant.service';

@Module({
  imports: [TypeOrmModule.forFeature([BookingParticipant])],
  controllers: [BookingParticipantController],
  providers: [BookingParticipantService],
  exports: [BookingParticipantService],
})
export class BookingParticipantModule {}
