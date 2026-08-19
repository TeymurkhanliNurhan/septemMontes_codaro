import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AvailabilityExceptionType } from '../../common/enums/availability-exception-type.enum';
import { Resource } from '../../resource/entities/resource.entity';

@Entity('availability_exceptions')
@Index('idx_availability_exceptions_resource_date', ['resourceId', 'exceptionDate'])
export class AvailabilityException {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ type: 'uuid', name: 'resource_id' })
  resourceId: string;

  @ManyToOne(() => Resource, (resource) => resource.availabilityExceptions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'resource_id' })
  resource: Resource;

  @Column({ type: 'date', name: 'exception_date' })
  exceptionDate: string;

  @Column({ type: 'time', name: 'start_time' })
  startTime: string;

  @Column({ type: 'time', name: 'end_time' })
  endTime: string;

  @Column({ type: 'varchar', length: 50, name: 'exception_type' })
  exceptionType: AvailabilityExceptionType;

  @Column({ type: 'text', name: 'reason', nullable: true })
  reason: string | null;

  @Column({ type: 'jsonb', name: 'metadata', default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
