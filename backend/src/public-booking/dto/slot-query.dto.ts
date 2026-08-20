import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, Matches } from 'class-validator';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class SlotQueryDto {
  @ApiProperty({
    example: '2026-08-24',
    description: 'Local date in the org timezone',
  })
  @Matches(ISO_DATE, { message: 'from must be YYYY-MM-DD' })
  from: string;

  @ApiProperty({ example: '2026-08-30' })
  @Matches(ISO_DATE, { message: 'to must be YYYY-MM-DD' })
  to: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  resourceId?: string;
}
