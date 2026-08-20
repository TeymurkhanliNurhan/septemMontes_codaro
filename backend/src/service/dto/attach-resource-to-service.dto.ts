import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AttachResourceToServiceDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Resource to attach to the service (same organization)',
    example: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  })
  @IsUUID()
  resourceId: string;
}
