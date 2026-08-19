import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { BookingEventType } from '../../common/enums/booking-event-type.enum';

export class UpdateBookingEventDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id: string;

  @ApiPropertyOptional({ enum: BookingEventType })
  @IsOptional()
  @IsEnum(BookingEventType)
  eventType?: BookingEventType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
