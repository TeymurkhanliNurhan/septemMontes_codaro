import { ApiProperty } from '@nestjs/swagger';
import { ResourceSelectionMode } from '../../common/enums/resource-selection-mode.enum';

export class PublicServiceDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty()
  durationMinutes: number;

  @ApiProperty({ enum: ResourceSelectionMode })
  resourceSelectionMode: ResourceSelectionMode;
}
