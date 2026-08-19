import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema20260820000000 implements MigrationInterface {
  name = 'InitialSchema20260820000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        name varchar(255) NOT NULL,
        slug varchar(255) NOT NULL,
        timezone varchar(100) NOT NULL DEFAULT 'utc',
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT organizations_pk PRIMARY KEY (id),
        CONSTRAINT organizations_slug_unique UNIQUE (slug)
      );

      CREATE TABLE IF NOT EXISTS users (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL,
        name varchar(255) NOT NULL,
        email varchar(255) NOT NULL,
        role varchar(50) NOT NULL DEFAULT 'STAFF',
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT users_pk PRIMARY KEY (id),
        CONSTRAINT uq_users_organization_email UNIQUE (organization_id, email),
        CONSTRAINT chk_users_role CHECK (role IN ('OWNER', 'ADMIN', 'STAFF', 'CUSTOMER'))
      );
      CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users (organization_id);

      CREATE TABLE IF NOT EXISTS customers (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL,
        name varchar(255) NOT NULL,
        email varchar(255) NULL,
        phone varchar(100) NULL,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT customers_pk PRIMARY KEY (id)
      );
      CREATE INDEX IF NOT EXISTS idx_customers_organization_id ON customers (organization_id);
      CREATE INDEX IF NOT EXISTS idx_customers_email ON customers (email);

      CREATE TABLE IF NOT EXISTS resources (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL,
        name varchar(255) NOT NULL,
        resource_type varchar(100) NULL,
        status varchar(50) NOT NULL DEFAULT 'ACTIVE',
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        organizations_id uuid NOT NULL,
        CONSTRAINT resources_pk PRIMARY KEY (id),
        CONSTRAINT chk_resources_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
      );
      CREATE INDEX IF NOT EXISTS idx_resources_organization_id ON resources (organization_id);
      CREATE INDEX IF NOT EXISTS idx_resources_status ON resources (status);

      CREATE TABLE IF NOT EXISTS services (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL,
        name varchar(255) NOT NULL,
        description text NULL,
        duration_minutes integer NOT NULL,
        buffer_before_minutes integer NOT NULL DEFAULT 0,
        buffer_after_minutes integer NOT NULL DEFAULT 0,
        is_active boolean NOT NULL DEFAULT true,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT services_pk PRIMARY KEY (id),
        CONSTRAINT chk_service_duration CHECK (duration_minutes > 0),
        CONSTRAINT chk_service_buffer_before CHECK (buffer_before_minutes >= 0),
        CONSTRAINT chk_service_buffer_after CHECK (buffer_after_minutes >= 0)
      );
      CREATE INDEX IF NOT EXISTS idx_services_organization_id ON services (organization_id);
      CREATE INDEX IF NOT EXISTS idx_services_active ON services (is_active);

      CREATE TABLE IF NOT EXISTS availability_rules (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        resource_id uuid NOT NULL,
        day_of_week smallint NOT NULL,
        start_time time NOT NULL,
        end_time time NOT NULL,
        timezone varchar(100) NULL,
        is_active boolean NOT NULL DEFAULT true,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT availability_rules_pk PRIMARY KEY (id),
        CONSTRAINT chk_availability_day CHECK (day_of_week BETWEEN 0 AND 6),
        CONSTRAINT chk_availability_time CHECK (start_time < end_time)
      );
      CREATE INDEX IF NOT EXISTS idx_availability_rules_resource_id ON availability_rules (resource_id);

      CREATE TABLE IF NOT EXISTS availability_exceptions (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        resource_id uuid NOT NULL,
        exception_date date NOT NULL,
        start_time time NOT NULL,
        end_time time NOT NULL,
        exception_type varchar(50) NOT NULL,
        reason text NULL,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT availability_exceptions_pk PRIMARY KEY (id),
        CONSTRAINT chk_availability_exception_time CHECK (start_time < end_time),
        CONSTRAINT chk_availability_exception_type CHECK (exception_type IN ('UNAVAILABLE', 'AVAILABLE'))
      );
      CREATE INDEX IF NOT EXISTS idx_availability_exceptions_resource_date ON availability_exceptions (resource_id, exception_date);

      CREATE TABLE IF NOT EXISTS bookings (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL,
        customer_id uuid NULL,
        service_id uuid NULL,
        created_by_user_id uuid NULL,
        starts_at timestamptz NOT NULL,
        ends_at timestamptz NOT NULL,
        status varchar(50) NOT NULL DEFAULT 'PENDING',
        title varchar(255) NULL,
        notes text NULL,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT bookings_pk PRIMARY KEY (id),
        CONSTRAINT chk_booking_time CHECK (starts_at < ends_at),
        CONSTRAINT chk_booking_status CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'))
      );
      CREATE INDEX IF NOT EXISTS idx_bookings_organization_id ON bookings (organization_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings (customer_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_service_id ON bookings (service_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_starts_at ON bookings (starts_at);
      CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);

      CREATE TABLE IF NOT EXISTS booking_events (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        booking_id uuid NOT NULL,
        actor_user_id uuid NULL,
        event_type varchar(50) NOT NULL,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT booking_events_pk PRIMARY KEY (id),
        CONSTRAINT chk_booking_event_type CHECK (event_type IN ('CREATED', 'CONFIRMED', 'CANCELLED', 'RESCHEDULED', 'COMPLETED', 'NO_SHOW'))
      );
      CREATE INDEX IF NOT EXISTS idx_booking_events_booking_id ON booking_events (booking_id);
      CREATE INDEX IF NOT EXISTS idx_booking_events_created_at ON booking_events (created_at);

      CREATE TABLE IF NOT EXISTS booking_participants (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        booking_id uuid NOT NULL,
        customer_id uuid NULL,
        user_id uuid NULL,
        role varchar(100) NULL,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT booking_participants_pk PRIMARY KEY (id),
        CONSTRAINT chk_booking_participant_owner CHECK (
          (customer_id IS NOT NULL AND user_id IS NULL) OR
          (customer_id IS NULL AND user_id IS NOT NULL)
        )
      );
      CREATE INDEX IF NOT EXISTS idx_booking_participants_booking_id ON booking_participants (booking_id);

      CREATE TABLE IF NOT EXISTS booking_resources (
        booking_id uuid NOT NULL,
        resource_id uuid NOT NULL,
        CONSTRAINT booking_resources_pk PRIMARY KEY (booking_id, resource_id)
      );
      CREATE INDEX IF NOT EXISTS idx_booking_resources_resource_id ON booking_resources (resource_id);

      CREATE TABLE IF NOT EXISTS service_resources (
        service_id uuid NOT NULL,
        resource_id uuid NOT NULL,
        CONSTRAINT service_resources_pk PRIMARY KEY (service_id, resource_id)
      );
      CREATE INDEX IF NOT EXISTS idx_service_resources_resource_id ON service_resources (resource_id);

      ALTER TABLE users ADD CONSTRAINT fk_users_organization
        FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE;

      ALTER TABLE customers ADD CONSTRAINT fk_customers_organization
        FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE;

      ALTER TABLE resources ADD CONSTRAINT fk_resources_organization
        FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE;

      ALTER TABLE resources ADD CONSTRAINT resources_organizations
        FOREIGN KEY (organizations_id) REFERENCES organizations (id);

      ALTER TABLE services ADD CONSTRAINT fk_services_organization
        FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE;

      ALTER TABLE availability_rules ADD CONSTRAINT fk_availability_rules_resource
        FOREIGN KEY (resource_id) REFERENCES resources (id) ON DELETE CASCADE;

      ALTER TABLE availability_exceptions ADD CONSTRAINT fk_availability_exceptions_resource
        FOREIGN KEY (resource_id) REFERENCES resources (id) ON DELETE CASCADE;

      ALTER TABLE bookings ADD CONSTRAINT fk_bookings_organization
        FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE;

      ALTER TABLE bookings ADD CONSTRAINT fk_bookings_customer
        FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL;

      ALTER TABLE bookings ADD CONSTRAINT fk_bookings_service
        FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE SET NULL;

      ALTER TABLE bookings ADD CONSTRAINT fk_bookings_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL;

      ALTER TABLE booking_events ADD CONSTRAINT fk_booking_events_booking
        FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE;

      ALTER TABLE booking_events ADD CONSTRAINT fk_booking_events_actor
        FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL;

      ALTER TABLE booking_participants ADD CONSTRAINT fk_booking_participants_booking
        FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE;

      ALTER TABLE booking_participants ADD CONSTRAINT fk_booking_participants_customer
        FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE;

      ALTER TABLE booking_participants ADD CONSTRAINT fk_booking_participants_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

      ALTER TABLE booking_resources ADD CONSTRAINT fk_booking_resources_booking
        FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE;

      ALTER TABLE booking_resources ADD CONSTRAINT fk_booking_resources_resource
        FOREIGN KEY (resource_id) REFERENCES resources (id) ON DELETE RESTRICT;

      ALTER TABLE service_resources ADD CONSTRAINT fk_service_resources_service
        FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE;

      ALTER TABLE service_resources ADD CONSTRAINT fk_service_resources_resource
        FOREIGN KEY (resource_id) REFERENCES resources (id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS service_resources CASCADE;
      DROP TABLE IF EXISTS booking_resources CASCADE;
      DROP TABLE IF EXISTS booking_participants CASCADE;
      DROP TABLE IF EXISTS booking_events CASCADE;
      DROP TABLE IF EXISTS bookings CASCADE;
      DROP TABLE IF EXISTS availability_exceptions CASCADE;
      DROP TABLE IF EXISTS availability_rules CASCADE;
      DROP TABLE IF EXISTS services CASCADE;
      DROP TABLE IF EXISTS resources CASCADE;
      DROP TABLE IF EXISTS customers CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS organizations CASCADE;
    `);
  }
}
