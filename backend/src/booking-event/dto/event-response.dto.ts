import { ApiProperty } from '@nestjs/swagger';
import { BookingEventType } from '../../common/enums/booking-event-type.enum';

export class BookingEventResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;
}
