import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingResource } from './entities/booking-resource.entity';
import { BookingResourceController } from './booking-resource.controller';
import { BookingResourceService } from './booking-resource.service';

@Module({
  imports: [TypeOrmModule.forFeature([BookingResource])],
  controllers: [BookingResourceController],
  providers: [BookingResourceService],
  exports: [BookingResourceService],
})
export class BookingResourceModule {}
