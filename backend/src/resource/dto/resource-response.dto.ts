import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResourceStatus } from '../../common/enums/resource-status.enum';

export class ResourceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  resourceType: string | null;

  @ApiProperty({ enum: ResourceStatus })
  status: ResourceStatus;

  @ApiProperty({ example: {} })
  metadata: Record<string, unknown>;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: string;
}

export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 1 })
  total: number;

  @ApiProperty({ example: 1 })
  totalPages: number;
}

export class ResourceListResponseDto {
  @ApiProperty({ type: [ResourceResponseDto] })
  data: ResourceResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class ResourceDataResponseDto {
  @ApiProperty({ type: ResourceResponseDto })
  data: ResourceResponseDto;
}

export class ResourceLinkedServiceDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '60 Minute Consultation' })
  name: string;

  @ApiProperty({ example: 60 })
  durationMinutes: number;

  @ApiProperty({ example: true })
  isActive: boolean;
}

export class ResourceLinkedServiceListResponseDto {
  @ApiProperty({ type: [ResourceLinkedServiceDto] })
  data: ResourceLinkedServiceDto[];
}
