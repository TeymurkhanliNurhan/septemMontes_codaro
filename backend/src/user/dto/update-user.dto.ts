import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../auth/auth.constants';
import { UserRole } from '../../common/enums/user-role.enum';

export class UpdateUserDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id: string;

  @ApiPropertyOptional({ example: 'Berkay Bayar' })
  @IsOptional()
  @IsString()
  @MaxLength(NAME_MAX_LENGTH)
  name?: string;

  @ApiPropertyOptional({ example: 'berkay@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email?: string;

  @ApiPropertyOptional({
    example: 'berkay123',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
