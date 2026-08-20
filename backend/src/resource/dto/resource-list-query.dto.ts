import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ResourceStatus } from '../../common/enums/resource-status.enum';

export class ResourceListQueryDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Case-insensitive name search',
    example: 'Room',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Filter by resource type',
    example: 'meeting_room',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  resourceType?: string;

  @ApiPropertyOptional({
    enum: ResourceStatus,
    enumName: 'ResourceStatus',
    description: 'Filter by status',
    example: ResourceStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ResourceStatus)
  status?: ResourceStatus;

  @ApiPropertyOptional({
    type: Number,
    description: 'Page number (1-based)',
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
    description: 'Items per page',
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
    enum: ['name', 'createdAt', 'updatedAt'],
    description: 'Sort field',
    example: 'createdAt',
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['name', 'createdAt', 'updatedAt'])
  sortBy?: 'name' | 'createdAt' | 'updatedAt' = 'createdAt';

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    description: 'Sort direction',
    example: 'desc',
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
