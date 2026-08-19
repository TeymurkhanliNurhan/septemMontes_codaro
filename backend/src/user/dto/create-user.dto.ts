import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { UserRole } from '../../common/enums/user-role.enum';

export class CreateUserDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  organizationId: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.STAFF })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateUserBodyDto extends CreateUserDto {
  @ApiPropertyOptional({ name: 'organization_id' })
  @IsOptional()
  @IsUUID()
  @Type(() => String)
  organization_id?: string;
}
