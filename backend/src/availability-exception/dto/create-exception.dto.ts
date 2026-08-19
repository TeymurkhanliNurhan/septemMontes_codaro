import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AvailabilityExceptionType } from '../../common/enums/availability-exception-type.enum';

export class CreateAvailabilityExceptionDto {
  @ApiProperty()
  @IsUUID()
  resourceId: string;

  @ApiProperty({ example: '2026-08-20' })
  @IsDateString()
  exceptionDate: string;

  @ApiProperty({ example: '09:00:00' })
  @IsString()
  startTime: string;

  @ApiProperty({ example: '12:00:00' })
  @IsString()
  endTime: string;

  @ApiProperty({ enum: AvailabilityExceptionType })
  @IsEnum(AvailabilityExceptionType)
  exceptionType: AvailabilityExceptionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
