import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Index('idx_sessions_user_id')
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 64, name: 'token_hash', unique: true })
  tokenHash: string;

  @Column({ type: 'varchar', length: 512, name: 'user_agent', nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 64, name: 'ip', nullable: true })
  ip: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'last_used_at' })
  lastUsedAt: Date;

  @Index('idx_sessions_expires_at')
  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', name: 'absolute_expires_at' })
  absoluteExpiresAt: Date;

  @Column({ type: 'timestamptz', name: 'revoked_at', nullable: true })
  revokedAt: Date | null;

  isActive(now: Date = new Date()): boolean {
    return (
      this.revokedAt === null &&
      this.expiresAt > now &&
      this.absoluteExpiresAt > now
    );
  }

  isStale(touchIntervalMs: number, now: Date = new Date()): boolean {
    return now.getTime() - this.lastUsedAt.getTime() >= touchIntervalMs;
  }
}
