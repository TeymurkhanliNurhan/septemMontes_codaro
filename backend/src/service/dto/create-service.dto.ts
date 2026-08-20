import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Validate,
  ValidateIf,
} from 'class-validator';
import { ResourceSelectionMode } from '../../common/enums/resource-selection-mode.enum';
import { IsPlainObjectConstraint } from '../../resource/dto/create-resource.dto';

export class CreateServiceDto {
  @ApiProperty({
    type: String,
    description: 'Display name of the service',
    example: '60 Minute Consultation',
    maxLength: 255,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Optional description',
    example: 'Standard consultation',
    nullable: true,
    maxLength: 5000,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiProperty({
    type: Number,
    description: 'Bookable duration in minutes',
    example: 60,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMinutes: number;

  @ApiPropertyOptional({
    type: Number,
    description: 'Buffer minutes before the booking',
    example: 0,
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bufferBeforeMinutes?: number;

  @ApiPropertyOptional({
    type: Number,
    description: 'Buffer minutes after the booking',
    example: 15,
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bufferAfterMinutes?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: ResourceSelectionMode })
  @IsOptional()
  @IsEnum(ResourceSelectionMode)
  resourceSelectionMode?: ResourceSelectionMode;

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
