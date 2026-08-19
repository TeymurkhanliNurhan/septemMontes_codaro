import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '../../common/enums/booking-status.enum';

export class BookingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;
}
