import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResourceModule } from '../resource/resource.module';
import { AvailabilityException } from './entities/availability-exception.entity';
import { AvailabilityExceptionController } from './availability-exception.controller';
import { AvailabilityExceptionService } from './availability-exception.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AvailabilityException]),
    ResourceModule,
  ],
  controllers: [AvailabilityExceptionController],
  providers: [AvailabilityExceptionService],
  exports: [AvailabilityExceptionService],
})
export class AvailabilityExceptionModule {}
