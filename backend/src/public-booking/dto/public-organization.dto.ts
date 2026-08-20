import { ApiProperty } from '@nestjs/swagger';

export class PublicOrganizationDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty({ example: 'Europe/Istanbul' }) timezone: string;
}
