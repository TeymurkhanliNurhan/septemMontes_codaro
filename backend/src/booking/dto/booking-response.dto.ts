import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '../../common/enums/booking-status.enum';

export class BookingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  organizationId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  customerId: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  serviceId: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  createdByUserId: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  startsAt: string;

  @ApiProperty({ type: String, format: 'date-time' })
  endsAt: string;

  @ApiProperty({ enum: BookingStatus })
  status: BookingStatus;

  @ApiPropertyOptional({ nullable: true })
  title: string | null;

  @ApiPropertyOptional({ nullable: true })
  notes: string | null;

  @ApiProperty({ example: {} })
  metadata: Record<string, unknown>;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: string;
}

export class BookingListResponseDto {
  @ApiProperty({ type: [BookingResponseDto] })
  data: BookingResponseDto[];
}

export class BookingDataResponseDto {
  @ApiProperty({ type: BookingResponseDto })
  data: BookingResponseDto;
}
