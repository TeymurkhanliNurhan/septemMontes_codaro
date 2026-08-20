import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResourceSelectionMode } from '../../common/enums/resource-selection-mode.enum';
import { PaginationMetaDto } from '../../resource/dto/resource-response.dto';

export class ServiceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '60 Minute Consultation' })
  name: string;

  @ApiPropertyOptional({ nullable: true, example: 'Standard consultation' })
  description: string | null;

  @ApiProperty({ example: 60 })
  durationMinutes: number;

  @ApiProperty({ example: 0 })
  bufferBeforeMinutes: number;

  @ApiProperty({ example: 15 })
  bufferAfterMinutes: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ enum: ResourceSelectionMode })
  resourceSelectionMode: ResourceSelectionMode;

  @ApiProperty({ example: {} })
  metadata: Record<string, unknown>;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: string;
}

export class ServiceListResponseDto {
  @ApiProperty({ type: [ServiceResponseDto] })
  data: ServiceResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class ServiceDataResponseDto {
  @ApiProperty({ type: ServiceResponseDto })
  data: ServiceResponseDto;
}

export class ServiceLinkedResourceDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Doctor A' })
  name: string;

  @ApiPropertyOptional({ nullable: true, example: 'doctor' })
  resourceType: string | null;

  @ApiProperty({ example: 'ACTIVE' })
  status: string;
}

export class ServiceLinkedResourceListResponseDto {
  @ApiProperty({ type: [ServiceLinkedResourceDto] })
  data: ServiceLinkedResourceDto[];
}

export class ServiceResourceResponseDto {
  @ApiProperty({ format: 'uuid' })
  serviceId: string;

  @ApiProperty({ format: 'uuid' })
  resourceId: string;
}

export class ServiceResourceDataResponseDto {
  @ApiProperty({ type: ServiceResourceResponseDto })
  data: ServiceResourceResponseDto;
}
