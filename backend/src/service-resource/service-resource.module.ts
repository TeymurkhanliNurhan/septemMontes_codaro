import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceResource } from './entities/service-resource.entity';

/**
 * Entity-only module. Service ↔ resource linking is exposed via nested
 * routes on ServiceController (`/services/:id/resources`).
 */
@Module({
  imports: [TypeOrmModule.forFeature([ServiceResource])],
  exports: [TypeOrmModule],
})
export class ServiceResourceModule {}
