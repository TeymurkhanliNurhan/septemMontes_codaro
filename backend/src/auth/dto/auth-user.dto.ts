import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthUser } from '../../common/types/authenticated-request';
import { User } from '../../user/entities/user.entity';

export class AuthUserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  organizationId: string;

  @ApiProperty({ example: 'berkay@example.com' })
  email: string;

  @ApiProperty({ example: 'Berkay Bayar' })
  name: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  static fromEntity(user: User): AuthUserDto {
    return {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }

  static fromAuthUser(user: AuthUser): AuthUserDto {
    return {
      id: user.userId,
      organizationId: user.organizationId,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}
