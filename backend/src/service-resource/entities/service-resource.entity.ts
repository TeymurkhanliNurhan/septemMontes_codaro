import {
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Service } from '../../service/entities/service.entity';
import { Resource } from '../../resource/entities/resource.entity';

@Entity('service_resources')
@Index('idx_service_resources_resource_id', ['resourceId'])
export class ServiceResource {
  @PrimaryColumn({ type: 'uuid', name: 'service_id' })
  serviceId: string;

  @PrimaryColumn({ type: 'uuid', name: 'resource_id' })
  resourceId: string;

  @ManyToOne(() => Service, (service) => service.serviceResources, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @ManyToOne(() => Resource, (resource) => resource.serviceResources, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'resource_id' })
  resource: Resource;
}
