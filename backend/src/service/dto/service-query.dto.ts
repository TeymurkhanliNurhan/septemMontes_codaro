import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class ServiceQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'When set, returns a single service. Combine with include=resources to list linked resources.',
    example: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({
    enum: ['resources'],
    description:
      'With id: return linked resources instead of the service entity',
    example: 'resources',
  })
  @IsOptional()
  @IsIn(['resources'])
  include?: 'resources';

  @ApiPropertyOptional({
    type: String,
    description: 'Case-insensitive name search (list mode)',
    example: 'Consultation',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: ['ACTIVE', 'INACTIVE'],
    description: 'Filter by active status (list mode)',
    example: 'ACTIVE',
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';

  @ApiPropertyOptional({
    type: Number,
    description: 'Page number (1-based, list mode)',
    example: 1,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    type: Number,
    description: 'Items per page (list mode)',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    enum: ['name', 'durationMinutes', 'createdAt', 'updatedAt'],
    description: 'Sort field (list mode)',
    example: 'createdAt',
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['name', 'durationMinutes', 'createdAt', 'updatedAt'])
  sortBy?: 'name' | 'durationMinutes' | 'createdAt' | 'updatedAt' = 'createdAt';

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    description: 'Sort direction (list mode)',
    example: 'desc',
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
