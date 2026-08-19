import { ApiProperty } from '@nestjs/swagger';
import { AvailabilityExceptionType } from '../../common/enums/availability-exception-type.enum';

export class AvailabilityExceptionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;
}
