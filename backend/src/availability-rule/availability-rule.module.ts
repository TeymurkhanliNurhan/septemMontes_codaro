import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResourceModule } from '../resource/resource.module';
import { AvailabilityRule } from './entities/availability-rule.entity';
import { AvailabilityRuleController } from './availability-rule.controller';
import { AvailabilityRuleService } from './availability-rule.service';

@Module({
  imports: [TypeOrmModule.forFeature([AvailabilityRule]), ResourceModule],
  controllers: [AvailabilityRuleController],
  providers: [AvailabilityRuleService],
  exports: [AvailabilityRuleService],
})
export class AvailabilityRuleModule {}
