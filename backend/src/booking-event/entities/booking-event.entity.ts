import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BookingEventType } from '../../common/enums/booking-event-type.enum';
import { Booking } from '../../booking/entities/booking.entity';
import { User } from '../../user/entities/user.entity';

@Entity('booking_events')
@Index('idx_booking_events_booking_id', ['bookingId'])
@Index('idx_booking_events_created_at', ['createdAt'])
export class BookingEvent {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ type: 'uuid', name: 'booking_id' })
  bookingId: string;

  @ManyToOne(() => Booking, (booking) => booking.events, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @Column({ type: 'uuid', name: 'actor_user_id', nullable: true })
  actorUserId: string | null;

  @ManyToOne(() => User, (user) => user.bookingEvents, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'actor_user_id' })
  actorUser: User | null;

  @Column({ type: 'varchar', length: 50, name: 'event_type' })
  eventType: BookingEventType;

  @Column({ type: 'jsonb', name: 'payload', default: {} })
  payload: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
