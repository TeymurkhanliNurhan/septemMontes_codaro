import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AvailabilityExceptionType } from '../../common/enums/availability-exception-type.enum';

export class AvailabilityExceptionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  resourceId: string;

  @ApiProperty({ example: '2026-08-25' })
  exceptionDate: string;

  @ApiProperty({ example: '12:00' })
  startTime: string;

  @ApiProperty({ example: '18:00' })
  endTime: string;

  @ApiProperty({ enum: AvailabilityExceptionType })
  exceptionType: AvailabilityExceptionType;

  @ApiPropertyOptional({ nullable: true, example: 'Maintenance' })
  reason: string | null;

  @ApiProperty({ example: {} })
  metadata: Record<string, unknown>;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: string;
}

export class AvailabilityExceptionListResponseDto {
  @ApiProperty({ type: [AvailabilityExceptionResponseDto] })
  data: AvailabilityExceptionResponseDto[];
}

export class AvailabilityExceptionDataResponseDto {
  @ApiProperty({ type: AvailabilityExceptionResponseDto })
  data: AvailabilityExceptionResponseDto;
}
