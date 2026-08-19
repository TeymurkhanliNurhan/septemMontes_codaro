import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { Booking } from '../../booking/entities/booking.entity';
import { ServiceResource } from '../../service-resource/entities/service-resource.entity';

@Entity('services')
@Index('idx_services_organization_id', ['organizationId'])
@Index('idx_services_active', ['isActive'])
export class Service {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization, (organization) => organization.services, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ type: 'varchar', length: 255, name: 'name' })
  name: string;

  @Column({ type: 'text', name: 'description', nullable: true })
  description: string | null;

  @Column({ type: 'int', name: 'duration_minutes' })
  durationMinutes: number;

  @Column({ type: 'int', name: 'buffer_before_minutes', default: 0 })
  bufferBeforeMinutes: number;

  @Column({ type: 'int', name: 'buffer_after_minutes', default: 0 })
  bufferAfterMinutes: number;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', name: 'metadata', default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Booking, (booking) => booking.service)
  bookings: Booking[];

  @OneToMany(() => ServiceResource, (sr) => sr.service)
  serviceResources: ServiceResource[];
}
