import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class RescheduleBookingDto {
  @ApiProperty({ type: String, format: 'date-time' })
  @IsDateString()
  startsAt: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @IsDateString()
  endsAt: string;

  @ApiPropertyOptional({
    example: 'Customer requested a new time',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
