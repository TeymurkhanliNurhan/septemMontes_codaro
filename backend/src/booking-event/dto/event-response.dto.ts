import { ApiProperty } from '@nestjs/swagger';

export class BookingEventResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;
}
