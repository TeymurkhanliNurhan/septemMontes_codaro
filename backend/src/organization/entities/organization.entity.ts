import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Customer } from '../../customer/entities/customer.entity';
import { Resource } from '../../resource/entities/resource.entity';
import { Service } from '../../service/entities/service.entity';
import { Booking } from '../../booking/entities/booking.entity';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ type: 'varchar', length: 255, name: 'name' })
  name: string;

  @Column({ type: 'varchar', length: 255, name: 'slug', unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 100, name: 'timezone', default: 'utc' })
  timezone: string;

  @Column({ type: 'jsonb', name: 'metadata', default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => User, (user) => user.organization)
  users: User[];

  @OneToMany(() => Customer, (customer) => customer.organization)
  customers: Customer[];

  @OneToMany(() => Resource, (resource) => resource.organization)
  resources: Resource[];

  @OneToMany(() => Service, (service) => service.organization)
  services: Service[];

  @OneToMany(() => Booking, (booking) => booking.organization)
  bookings: Booking[];
}
