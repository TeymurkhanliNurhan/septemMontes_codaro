import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Validate,
  ValidateIf,
} from 'class-validator';
import { ResourceStatus } from '../../common/enums/resource-status.enum';
import { IsPlainObjectConstraint } from './create-resource.dto';

export class UpdateResourceDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Display name of the resource',
    example: 'Room A - Large',
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
    description: 'Optional generic type label',
    example: 'meeting_room',
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
  resourceType?: string | null;

  @ApiPropertyOptional({
    enum: ResourceStatus,
    enumName: 'ResourceStatus',
    description: 'ACTIVE or INACTIVE',
    example: ResourceStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ResourceStatus)
  status?: ResourceStatus;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Arbitrary JSON object (not an array)',
    example: { capacity: 10, floor: 2 },
  })
  @IsOptional()
  @IsObject()
  @Validate(IsPlainObjectConstraint)
  metadata?: Record<string, unknown>;
}
