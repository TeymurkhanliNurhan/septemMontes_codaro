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
import { ResourceStatus } from '../../common/enums/resource-status.enum';
import { Organization } from '../../organization/entities/organization.entity';
import { AvailabilityRule } from '../../availability-rule/entities/availability-rule.entity';
import { AvailabilityException } from '../../availability-exception/entities/availability-exception.entity';
import { BookingResource } from '../../booking-resource/entities/booking-resource.entity';
import { ServiceResource } from '../../service-resource/entities/service-resource.entity';

@Entity('resources')
@Index('idx_resources_organization_id', ['organizationId'])
@Index('idx_resources_status', ['status'])
export class Resource {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization, (organization) => organization.resources, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ type: 'varchar', length: 255, name: 'name' })
  name: string;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'resource_type',
    nullable: true,
  })
  resourceType: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'status',
    default: ResourceStatus.ACTIVE,
  })
  status: ResourceStatus;

  @Column({ type: 'jsonb', name: 'metadata', default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'uuid', name: 'organizations_id' })
  organizationsId: string;

  @ManyToOne(() => Organization, { nullable: false })
  @JoinColumn({ name: 'organizations_id' })
  organizations: Organization;

  @OneToMany(() => AvailabilityRule, (rule) => rule.resource)
  availabilityRules: AvailabilityRule[];

  @OneToMany(() => AvailabilityException, (exception) => exception.resource)
  availabilityExceptions: AvailabilityException[];

  @OneToMany(() => BookingResource, (br) => br.resource)
  bookingResources: BookingResource[];

  @OneToMany(() => ServiceResource, (sr) => sr.resource)
  serviceResources: ServiceResource[];
}
