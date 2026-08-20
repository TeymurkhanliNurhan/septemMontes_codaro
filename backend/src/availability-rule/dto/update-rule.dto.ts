import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidateIf,
} from 'class-validator';
import { HH_MM_PATTERN } from '../../common/utils/time';
import { IsPlainObjectConstraint } from '../../resource/dto/create-resource.dto';

export class UpdateAvailabilityRuleDto {
  @ApiPropertyOptional({
    type: Number,
    description: 'Day of week (0=Sunday … 6=Saturday)',
    example: 1,
    minimum: 0,
    maximum: 6,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @ApiPropertyOptional({
    type: String,
    description: 'Start time in HH:mm',
    example: '10:00',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(HH_MM_PATTERN, { message: 'startTime must be HH:mm' })
  startTime?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'End time in HH:mm',
    example: '18:00',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(HH_MM_PATTERN, { message: 'endTime must be HH:mm' })
  endTime?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'IANA timezone or null to clear',
    example: 'Europe/Warsaw',
    nullable: true,
    maxLength: 100,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  timezone?: string | null;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Whether the rule is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Arbitrary JSON object (not an array)',
    example: {},
  })
  @IsOptional()
  @IsObject()
  @Validate(IsPlainObjectConstraint)
  metadata?: Record<string, unknown>;
}
