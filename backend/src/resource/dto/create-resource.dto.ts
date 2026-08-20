import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isPlainObject', async: false })
export class IsPlainObjectConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return (
      typeof value === 'object' && value !== null && !Array.isArray(value)
    );
  }

  defaultMessage(): string {
    return 'metadata must be a JSON object';
  }
}

export class CreateResourceDto {
  @ApiProperty({
    type: String,
    description: 'Display name of the resource',
    example: 'Room A',
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
    description: 'Optional generic type label (e.g. meeting_room, vehicle)',
    example: 'meeting_room',
    nullable: true,
    maxLength: 100,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  resourceType?: string | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Arbitrary JSON object (not an array)',
    example: { capacity: 8, floor: 2 },
    default: {},
  })
  @IsOptional()
  @IsObject()
  @Validate(IsPlainObjectConstraint)
  metadata?: Record<string, unknown>;
}
