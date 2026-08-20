import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../booking/entities/booking.entity';
import { ResourceModule } from '../resource/resource.module';
import { ServiceResource } from '../service-resource/entities/service-resource.entity';
import { Service } from './entities/service.entity';
import { ServiceController } from './service.controller';
import { ServiceService } from './service.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Service, ServiceResource, Booking]),
    ResourceModule,
  ],
  controllers: [ServiceController],
  providers: [ServiceService],
  exports: [ServiceService],
})
export class ServiceModule {}
