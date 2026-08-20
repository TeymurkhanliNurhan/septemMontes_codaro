import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../auth.constants';
import { UserRole } from '../../common/enums/user-role.enum';

export class RegisterUserDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MaxLength(NAME_MAX_LENGTH)
  name: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email: string;

  @ApiProperty({
    example: 'SecurePass123!',
    minLength: PASSWORD_MIN_LENGTH,
  })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.STAFF,
    description: 'Selectable user role',
  })
  @IsEnum(UserRole)
  role: UserRole;
}
