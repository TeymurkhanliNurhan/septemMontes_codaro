import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Booking } from '../../booking/entities/booking.entity';
import { Resource } from '../../resource/entities/resource.entity';

@Entity('booking_resources')
@Index('idx_booking_resources_resource_id', ['resourceId'])
export class BookingResource {
  @PrimaryColumn({ type: 'uuid', name: 'booking_id' })
  bookingId: string;

  @PrimaryColumn({ type: 'uuid', name: 'resource_id' })
  resourceId: string;

  @ManyToOne(() => Booking, (booking) => booking.bookingResources, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @ManyToOne(() => Resource, (resource) => resource.bookingResources, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'resource_id' })
  resource: Resource;
}
