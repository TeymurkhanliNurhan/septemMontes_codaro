import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Validate,
} from 'class-validator';
import { IsPlainObjectConstraint } from '../../resource/dto/create-resource.dto';

export class CreateBookingDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @IsDateString()
  startsAt: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @IsDateString()
  endsAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: {},
  })
  @IsOptional()
  @IsObject()
  @Validate(IsPlainObjectConstraint)
  metadata?: Record<string, unknown>;
}
