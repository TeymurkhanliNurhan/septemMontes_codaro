import { ApiProperty } from '@nestjs/swagger';

export class ResourceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;
}
