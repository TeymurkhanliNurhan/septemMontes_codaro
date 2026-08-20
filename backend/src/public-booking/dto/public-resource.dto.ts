import { ApiProperty } from '@nestjs/swagger';

export class PublicResourceDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  resourceType: string | null;
}
