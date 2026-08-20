import { ApiProperty } from '@nestjs/swagger';

export class AvailabilityExceptionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;
}
