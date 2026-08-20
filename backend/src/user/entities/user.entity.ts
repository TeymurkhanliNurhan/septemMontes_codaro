import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { Organization } from '../../organization/entities/organization.entity';
import { Booking } from '../../booking/entities/booking.entity';
import { BookingEvent } from '../../booking-event/entities/booking-event.entity';
import { BookingParticipant } from '../../booking-participant/entities/booking-participant.entity';

@Entity('users')
@Unique('uq_users_organization_email', ['organizationId', 'email'])
export class User {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization, (organization) => organization.users, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ type: 'varchar', length: 255, name: 'name' })
  name: string;

  @Column({ type: 'varchar', length: 255, name: 'email' })
  email: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'password_hash',
    nullable: true,
    select: false,
  })
  passwordHash: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'role',
    default: UserRole.STAFF,
  })
  role: UserRole;

  @Column({ type: 'jsonb', name: 'metadata', default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', nullable: true })
  updatedAt: Date | null;

  @OneToMany(() => Booking, (booking) => booking.createdByUser)
  createdBookings: Booking[];

  @OneToMany(() => BookingEvent, (event) => event.actorUser)
  bookingEvents: BookingEvent[];

  @OneToMany(() => BookingParticipant, (participant) => participant.user)
  bookingParticipants: BookingParticipant[];
}
