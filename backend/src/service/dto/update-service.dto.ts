import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  Validate,
  ValidateIf,
} from 'class-validator';
import { IsPlainObjectConstraint } from '../../resource/dto/create-resource.dto';

export class UpdateServiceDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Service UUID to update',
    example: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  })
  @IsUUID()
  id: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Display name of the service',
    example: '90 Minute Consultation',
    maxLength: 255,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Optional description',
    example: 'Extended consultation',
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

  @ApiPropertyOptional({
    type: Number,
    description: 'Bookable duration in minutes',
    example: 90,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @ApiPropertyOptional({
    type: Number,
    description: 'Buffer minutes before the booking',
    example: 0,
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
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bufferAfterMinutes?: number;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Activate or deactivate the service',
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

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description:
      'When provided, replaces the full set of linked resource IDs for this service',
    example: ['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  resourceIds?: string[];
}
