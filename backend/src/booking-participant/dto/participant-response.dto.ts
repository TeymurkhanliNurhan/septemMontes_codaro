import { ApiProperty } from '@nestjs/swagger';

export class BookingParticipantResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;
}
