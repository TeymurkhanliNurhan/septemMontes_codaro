import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { AvailabilityExceptionType } from '../../common/enums/availability-exception-type.enum';
import { DATE_YMD_PATTERN } from '../../common/utils/time';

export class AvailabilityExceptionListQueryDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Inclusive start date filter (YYYY-MM-DD)',
    example: '2026-08-01',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(DATE_YMD_PATTERN, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Inclusive end date filter (YYYY-MM-DD)',
    example: '2026-08-31',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(DATE_YMD_PATTERN, { message: 'to must be YYYY-MM-DD' })
  to?: string;

  @ApiPropertyOptional({
    enum: AvailabilityExceptionType,
    description: 'Filter by exception type',
    example: AvailabilityExceptionType.UNAVAILABLE,
  })
  @IsOptional()
  @IsEnum(AvailabilityExceptionType)
  exceptionType?: AvailabilityExceptionType;
}
