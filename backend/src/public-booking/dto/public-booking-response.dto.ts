import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '../../common/enums/booking-status.enum';

export class PublicBookingResponseDto {
  @ApiProperty({ format: 'uuid' })
  bookingId: string;

  @ApiProperty()
  startsAt: string;

  @ApiProperty()
  endsAt: string;

  @ApiProperty({ enum: BookingStatus })
  status: BookingStatus;

  @ApiProperty()
  serviceName: string;

  @ApiProperty()
  resourceName: string;
}
