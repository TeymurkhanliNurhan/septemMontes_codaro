import { ApiProperty } from '@nestjs/swagger';


export class ServiceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;
}
