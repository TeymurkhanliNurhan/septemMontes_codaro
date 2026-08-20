import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingEventType } from '../../common/enums/booking-event-type.enum';

export class BookingEventResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  bookingId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  actorUserId: string | null;

  @ApiProperty({ enum: BookingEventType })
  eventType: BookingEventType;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { source: 'admin' },
  })
  payload: Record<string, unknown>;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: string;
}

export class BookingEventListResponseDto {
  @ApiProperty({ type: [BookingEventResponseDto] })
  data: BookingEventResponseDto[];
}

export class BookingEventDataResponseDto {
  @ApiProperty({ type: BookingEventResponseDto })
  data: BookingEventResponseDto;
}
