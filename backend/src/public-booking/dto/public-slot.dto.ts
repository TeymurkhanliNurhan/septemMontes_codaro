import { ApiProperty } from '@nestjs/swagger';

export class PublicSlotDto {
  @ApiProperty({ description: 'ISO-8601 UTC start of the slot' })
  startsAt: string;

  @ApiProperty({ description: 'ISO-8601 UTC end of the slot' })
  endsAt: string;

  @ApiProperty({ type: [String], format: 'uuid' })
  resourceIds: string[];
}
