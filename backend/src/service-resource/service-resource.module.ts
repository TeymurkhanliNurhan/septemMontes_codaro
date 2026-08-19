import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceResource } from './entities/service-resource.entity';
import { ServiceResourceController } from './service-resource.controller';
import { ServiceResourceService } from './service-resource.service';

@Module({
  imports: [TypeOrmModule.forFeature([ServiceResource])],
  controllers: [ServiceResourceController],
  providers: [ServiceResourceService],
  exports: [ServiceResourceService],
})
export class ServiceResourceModule {}
