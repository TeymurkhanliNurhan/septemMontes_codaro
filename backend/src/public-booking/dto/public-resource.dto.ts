import { ApiProperty } from '@nestjs/swagger';

export class PublicResourceDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: String, nullable: true })
  resourceType: string | null;
}
