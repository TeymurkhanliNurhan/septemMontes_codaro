import { ApiProperty } from '@nestjs/swagger';

export class BookingResourceResponseDto {
  @ApiProperty({ format: 'uuid' })
  bookingId: string;

  @ApiProperty({ format: 'uuid' })
  resourceId: string;
}
