import { ApiProperty } from '@nestjs/swagger';

export class ServiceResourceResponseDto {
  @ApiProperty({ format: 'uuid' })
  serviceId: string;

  @ApiProperty({ format: 'uuid' })
  resourceId: string;
}
