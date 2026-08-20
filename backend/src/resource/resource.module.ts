import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingResource } from '../booking-resource/entities/booking-resource.entity';
import { ServiceResource } from '../service-resource/entities/service-resource.entity';
import { Resource } from './entities/resource.entity';
import { ResourceController } from './resource.controller';
import { ResourceService } from './resource.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Resource, BookingResource, ServiceResource]),
  ],
  controllers: [ResourceController],
  providers: [ResourceService],
  exports: [ResourceService],
})
export class ResourceModule {}
