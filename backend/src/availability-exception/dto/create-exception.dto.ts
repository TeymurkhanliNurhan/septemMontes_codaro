import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Validate,
  ValidateIf,
} from 'class-validator';
import { AvailabilityExceptionType } from '../../common/enums/availability-exception-type.enum';
import { DATE_YMD_PATTERN, HH_MM_PATTERN } from '../../common/utils/time';
import { EndTimeAfterStartTimeConstraint } from '../../common/validators/end-time-after-start.constraint';
import { IsPlainObjectConstraint } from '../../resource/dto/create-resource.dto';

export class CreateAvailabilityExceptionDto {
  @ApiProperty({
    type: String,
    description: 'Exception date (YYYY-MM-DD)',
    example: '2026-08-25',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(DATE_YMD_PATTERN, {
    message: 'exceptionDate must be YYYY-MM-DD',
  })
  exceptionDate: string;

  @ApiProperty({
    type: String,
    description: 'Start time in HH:mm',
    example: '12:00',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(HH_MM_PATTERN, { message: 'startTime must be HH:mm' })
  startTime: string;

  @ApiProperty({
    type: String,
    description: 'End time in HH:mm (must be after startTime)',
    example: '18:00',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(HH_MM_PATTERN, { message: 'endTime must be HH:mm' })
  @Validate(EndTimeAfterStartTimeConstraint)
  endTime: string;

  @ApiProperty({
    enum: AvailabilityExceptionType,
    enumName: 'AvailabilityExceptionType',
    example: AvailabilityExceptionType.UNAVAILABLE,
  })
  @IsEnum(AvailabilityExceptionType)
  exceptionType: AvailabilityExceptionType;

  @ApiPropertyOptional({
    type: String,
    description: 'Optional reason (max 500 characters)',
    example: 'Maintenance',
    nullable: true,
    maxLength: 500,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(500)
  reason?: string | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Arbitrary JSON object (not an array)',
    example: {},
    default: {},
  })
  @IsOptional()
  @IsObject()
  @Validate(IsPlainObjectConstraint)
  metadata?: Record<string, unknown>;
}
