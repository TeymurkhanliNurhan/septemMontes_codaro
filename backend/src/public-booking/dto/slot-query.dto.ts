import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsUUID, Matches } from 'class-validator';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class SlotQueryDto {
  @ApiProperty({
    example: '2026-08-24',
    format: 'date',
    description: 'Local date in the org timezone',
  })
  @Matches(ISO_DATE, { message: 'from must be YYYY-MM-DD' })
  @IsISO8601(
    { strict: true, strictSeparator: true },
    { message: 'from must be a real calendar date' },
  )
  from: string;

  @ApiProperty({ example: '2026-08-30', format: 'date' })
  @Matches(ISO_DATE, { message: 'to must be YYYY-MM-DD' })
  @IsISO8601(
    { strict: true, strictSeparator: true },
    { message: 'to must be a real calendar date' },
  )
  to: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  resourceId?: string;
}
