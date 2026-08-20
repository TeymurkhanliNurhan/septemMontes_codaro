import { ApiProperty } from '@nestjs/swagger';
import { Session } from '../entities/session.entity';

export class SessionDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  current: boolean;

  @ApiProperty({ nullable: true })
  userAgent: string | null;

  @ApiProperty({ nullable: true })
  ip: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  lastUsedAt: Date;

  @ApiProperty()
  expiresAt: Date;

  static fromEntity(session: Session, currentSessionId: string): SessionDto {
    return {
      id: session.id,
      current: session.id === currentSessionId,
      userAgent: session.userAgent,
      ip: session.ip,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      expiresAt: session.expiresAt,
    };
  }
}
