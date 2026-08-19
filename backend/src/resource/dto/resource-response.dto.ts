import { ApiProperty } from '@nestjs/swagger';
import { ResourceStatus } from '../../common/enums/resource-status.enum';

export class ResourceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;
}
