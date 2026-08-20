import { ApiProperty } from '@nestjs/swagger';

export class AvailabilityRuleResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;
}
