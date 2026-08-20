import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsUUID } from 'class-validator';
import { BookingEventType } from '../../common/enums/booking-event-type.enum';

export class CreateBookingEventDto {
  @ApiProperty()
  @IsUUID()
  bookingId: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @ApiProperty({ enum: BookingEventType })
  @IsEnum(BookingEventType)
  eventType: BookingEventType;

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
