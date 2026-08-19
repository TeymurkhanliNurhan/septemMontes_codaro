import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {  IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';


export class CreateBookingParticipantDto {
  @ApiProperty()
  @IsUUID()
  bookingId: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
