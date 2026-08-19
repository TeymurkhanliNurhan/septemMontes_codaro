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
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Organization } from '../../organization/entities/organization.entity';
import { Customer } from '../../customer/entities/customer.entity';
import { Service } from '../../service/entities/service.entity';
import { User } from '../../user/entities/user.entity';
import { BookingEvent } from '../../booking-event/entities/booking-event.entity';
import { BookingParticipant } from '../../booking-participant/entities/booking-participant.entity';
import { BookingResource } from '../../booking-resource/entities/booking-resource.entity';

@Entity('bookings')
@Index('idx_bookings_organization_id', ['organizationId'])
@Index('idx_bookings_customer_id', ['customerId'])
@Index('idx_bookings_service_id', ['serviceId'])
@Index('idx_bookings_starts_at', ['startsAt'])
@Index('idx_bookings_status', ['status'])
export class Booking {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization, (organization) => organization.bookings, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ type: 'uuid', name: 'customer_id', nullable: true })
  customerId: string | null;

  @ManyToOne(() => Customer, (customer) => customer.bookings, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @Column({ type: 'uuid', name: 'service_id', nullable: true })
  serviceId: string | null;

  @ManyToOne(() => Service, (service) => service.bookings, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'service_id' })
  service: Service | null;

  @Column({ type: 'uuid', name: 'created_by_user_id', nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => User, (user) => user.createdBookings, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser: User | null;

  @Column({ type: 'timestamptz', name: 'starts_at' })
  startsAt: Date;

  @Column({ type: 'timestamptz', name: 'ends_at' })
  endsAt: Date;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'status',
    default: BookingStatus.PENDING,
  })
  status: BookingStatus;

  @Column({ type: 'varchar', length: 255, name: 'title', nullable: true })
  title: string | null;

  @Column({ type: 'text', name: 'notes', nullable: true })
  notes: string | null;

  @Column({ type: 'jsonb', name: 'metadata', default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => BookingEvent, (event) => event.booking)
  events: BookingEvent[];

  @OneToMany(() => BookingParticipant, (participant) => participant.booking)
  participants: BookingParticipant[];

  @OneToMany(() => BookingResource, (br) => br.booking)
  bookingResources: BookingResource[];
}
