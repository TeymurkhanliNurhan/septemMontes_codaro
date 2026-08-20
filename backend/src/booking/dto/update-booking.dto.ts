import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, Validate } from 'class-validator';
import { IsPlainObjectConstraint } from '../../resource/dto/create-resource.dto';

export class UpdateBookingDto {
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
