import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  Validate,
} from 'class-validator';
import { HH_MM_PATTERN } from '../../common/utils/time';
import { EndTimeAfterStartTimeConstraint } from '../../common/validators/end-time-after-start.constraint';
import { IsPlainObjectConstraint } from '../../resource/dto/create-resource.dto';

export class CreateAvailabilityRuleDto {
  @ApiProperty({
    type: Number,
    description: 'Day of week (0=Sunday … 6=Saturday)',
    example: 1,
    minimum: 0,
    maximum: 6,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({
    type: String,
    description: 'Start time in HH:mm',
    example: '09:00',
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

  @ApiPropertyOptional({
    type: String,
    description: 'IANA timezone or organization timezone label',
    example: 'Europe/Warsaw',
    nullable: true,
    maxLength: 100,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  timezone?: string;

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
