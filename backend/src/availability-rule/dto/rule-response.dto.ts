import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AvailabilityRuleResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  resourceId: string;

  @ApiProperty({ example: 1, minimum: 0, maximum: 6 })
  dayOfWeek: number;

  @ApiProperty({ example: '09:00' })
  startTime: string;

  @ApiProperty({ example: '18:00' })
  endTime: string;

  @ApiPropertyOptional({ nullable: true, example: 'Europe/Warsaw' })
  timezone: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: {} })
  metadata: Record<string, unknown>;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: string;
}

export class AvailabilityRuleListResponseDto {
  @ApiProperty({ type: [AvailabilityRuleResponseDto] })
  data: AvailabilityRuleResponseDto[];
}

export class AvailabilityRuleDataResponseDto {
  @ApiProperty({ type: AvailabilityRuleResponseDto })
  data: AvailabilityRuleResponseDto;
}

export class AvailabilityRuleActiveStatusResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: true })
  isActive: boolean;
}

export class AvailabilityRuleActiveStatusDataResponseDto {
  @ApiProperty({ type: AvailabilityRuleActiveStatusResponseDto })
  data: AvailabilityRuleActiveStatusResponseDto;
}
