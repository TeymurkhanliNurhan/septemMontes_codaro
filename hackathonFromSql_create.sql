-- Created by Redgate Data Modeler (https://datamodeler.redgate-platform.com)
-- Last modification date: 2026-08-19 21:07:39.158

-- tables
-- Table: availability_exceptions
CREATE TABLE availability_exceptions (
    id uuid  NOT NULL DEFAULT gen_random_uuid(),
    resource_id uuid  NOT NULL,
    exception_date date  NOT NULL,
    start_time time  NOT NULL,
    end_time time  NOT NULL,
    exception_type varchar(50)  NOT NULL,
    reason text  NULL,
    metadata jsonb  NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT chk_availability_exception_time CHECK (( start_time < end_time )) NOT DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT chk_availability_exception_type CHECK (( exception_type IN ( 'UNAVAILABLE' , 'AVAILABLE' ) )) NOT DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT availability_exceptions_pk PRIMARY KEY (id)
);

CREATE INDEX idx_availability_exceptions_resource_date on availability_exceptions (resource_id ASC,exception_date ASC);

-- Table: availability_rules
CREATE TABLE availability_rules (
    id uuid  NOT NULL DEFAULT gen_random_uuid(),
    resource_id uuid  NOT NULL,
    day_of_week smallint  NOT NULL,
    start_time time  NOT NULL,
    end_time time  NOT NULL,
    timezone varchar(100)  NULL,
    is_active boolean  NOT NULL DEFAULT true,
    metadata jsonb  NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz  NOT NULL DEFAULT now(),
    updated_at timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT chk_availability_day CHECK (( day_of_week BETWEEN 0 AND 6 )) NOT DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT chk_availability_time CHECK (( start_time < end_time )) NOT DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT availability_rules_pk PRIMARY KEY (id)
);

CREATE INDEX idx_availability_rules_resource_id on availability_rules (resource_id ASC);

-- Table: booking_events
CREATE TABLE booking_events (
    id uuid  NOT NULL DEFAULT gen_random_uuid(),
    booking_id uuid  NOT NULL,
    actor_user_id uuid  NULL,
    event_type varchar(50)  NOT NULL,
    payload jsonb  NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT chk_booking_event_type CHECK (( event_type IN ( 'CREATED' , 'CONFIRMED' , 'CANCELLED' , 'RESCHEDULED' , 'COMPLETED' , 'NO_SHOW' ) )) NOT DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT booking_events_pk PRIMARY KEY (id)
);

CREATE INDEX idx_booking_events_booking_id on booking_events (booking_id ASC);

CREATE INDEX idx_booking_events_created_at on booking_events (created_at ASC);

-- Table: booking_participants
CREATE TABLE booking_participants (
    id uuid  NOT NULL DEFAULT gen_random_uuid(),
    booking_id uuid  NOT NULL,
    customer_id uuid  NULL,
    user_id uuid  NULL,
    role varchar(100)  NULL,
    metadata jsonb  NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT chk_booking_participant_owner CHECK (( ( customer_id IS NOT NULL AND user_id IS NULL ) OR ( customer_id IS NULL AND user_id IS NOT NULL ) )) NOT DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT booking_participants_pk PRIMARY KEY (id)
);

CREATE INDEX idx_booking_participants_booking_id on booking_participants (booking_id ASC);

-- Table: booking_resources
CREATE TABLE booking_resources (
    booking_id uuid  NOT NULL,
    resource_id uuid  NOT NULL,
    CONSTRAINT booking_resources_pk PRIMARY KEY (booking_id,resource_id)
);

CREATE INDEX idx_booking_resources_resource_id on booking_resources (resource_id ASC);

-- Table: bookings
CREATE TABLE bookings (
    id uuid  NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid  NOT NULL,
    customer_id uuid  NULL,
    service_id uuid  NULL,
    created_by_user_id uuid  NULL,
    starts_at timestamptz  NOT NULL,
    ends_at timestamptz  NOT NULL,
    status varchar(50)  NOT NULL DEFAULT 'pending',
    title varchar(255)  NULL,
    notes text  NULL,
    metadata jsonb  NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz  NOT NULL DEFAULT now(),
    updated_at timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT chk_booking_time CHECK (( starts_at < ends_at )) NOT DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT chk_booking_status CHECK (( status IN ( 'PENDING' , 'CONFIRMED' , 'CANCELLED' , 'COMPLETED' , 'NO_SHOW' ) )) NOT DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT bookings_pk PRIMARY KEY (id)
);

CREATE INDEX idx_bookings_organization_id on bookings (organization_id ASC);

CREATE INDEX idx_bookings_customer_id on bookings (customer_id ASC);

CREATE INDEX idx_bookings_service_id on bookings (service_id ASC);

CREATE INDEX idx_bookings_starts_at on bookings (starts_at ASC);

CREATE INDEX idx_bookings_status on bookings (status ASC);

-- Table: customers
CREATE TABLE customers (
    id uuid  NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid  NOT NULL,
    name varchar(255)  NOT NULL,
    email varchar(255)  NULL,
    phone varchar(100)  NULL,
    metadata jsonb  NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz  NOT NULL DEFAULT now(),
    updated_at timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT customers_pk PRIMARY KEY (id)
);

CREATE INDEX idx_customers_organization_id on customers (organization_id ASC);

CREATE INDEX idx_customers_email on customers (email ASC);

-- Table: organizations
CREATE TABLE organizations (
    id uuid  NOT NULL DEFAULT gen_random_uuid(),
    name varchar(255)  NOT NULL,
    slug varchar(255)  NOT NULL,
    timezone varchar(100)  NOT NULL DEFAULT 'utc',
    metadata jsonb  NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz  NOT NULL DEFAULT now(),
    updated_at timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT AK_0 UNIQUE (slug) NOT DEFERRABLE  INITIALLY IMMEDIATE,
    CONSTRAINT organizations_pk PRIMARY KEY (id)
);

-- Table: resources
CREATE TABLE resources (
    id uuid  NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid  NOT NULL,
    name varchar(255)  NOT NULL,
    resource_type varchar(100)  NULL,
    status varchar(50)  NOT NULL DEFAULT 'active',
    metadata jsonb  NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz  NOT NULL DEFAULT now(),
    updated_at timestamptz  NOT NULL DEFAULT now(),
    organizations_id uuid  NOT NULL,
    CONSTRAINT chk_resources_status CHECK (( status IN ( 'ACTIVE' , 'INACTIVE' ) )) NOT DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT resources_pk PRIMARY KEY (id)
);

CREATE INDEX idx_resources_organization_id on resources (organization_id ASC);

CREATE INDEX idx_resources_status on resources (status ASC);

-- Table: service_resources
CREATE TABLE service_resources (
    service_id uuid  NOT NULL,
    resource_id uuid  NOT NULL,
    CONSTRAINT service_resources_pk PRIMARY KEY (service_id,resource_id)
);

CREATE INDEX idx_service_resources_resource_id on service_resources (resource_id ASC);

-- Table: services
CREATE TABLE services (
    id uuid  NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid  NOT NULL,
    name varchar(255)  NOT NULL,
    description text  NULL,
    duration_minutes integer  NOT NULL,
    buffer_before_minutes integer  NOT NULL DEFAULT 0,
    buffer_after_minutes integer  NOT NULL DEFAULT 0,
    is_active boolean  NOT NULL DEFAULT true,
    metadata jsonb  NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz  NOT NULL DEFAULT now(),
    updated_at timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT chk_service_duration CHECK (( duration_minutes > 0 )) NOT DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT chk_service_buffer_before CHECK (( buffer_before_minutes >= 0 )) NOT DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT chk_service_buffer_after CHECK (( buffer_after_minutes >= 0 )) NOT DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT services_pk PRIMARY KEY (id)
);

CREATE INDEX idx_services_organization_id on services (organization_id ASC);

CREATE INDEX idx_services_active on services (is_active ASC);

-- Table: users
CREATE TABLE users (
    id uuid  NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid  NOT NULL,
    name varchar(255)  NOT NULL,
    email varchar(255)  NOT NULL,
    role varchar(50)  NOT NULL DEFAULT 'staff',
    metadata jsonb  NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz  NOT NULL DEFAULT now(),
    updated_at timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT uq_users_organization_email UNIQUE (organization_id, email) NOT DEFERRABLE  INITIALLY IMMEDIATE,
    CONSTRAINT chk_users_role CHECK (( role IN ( 'OWNER' , 'ADMIN' , 'STAFF' , 'CUSTOMER' ) )) NOT DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT users_pk PRIMARY KEY (id)
);

CREATE INDEX idx_users_organization_id on users (organization_id ASC);

-- foreign keys
-- Reference: fk_availability_exceptions_resource (table: availability_exceptions)
ALTER TABLE availability_exceptions ADD CONSTRAINT fk_availability_exceptions_resource
    FOREIGN KEY (resource_id)
    REFERENCES resources (id)
    ON DELETE  CASCADE  
    NOT DEFERRABLE 
    INITIALLY IMMEDIATE
;

-- Reference: fk_availability_rules_resource (table: availability_rules)
ALTER TABLE availability_rules ADD CONSTRAINT fk_availability_rules_resource
    FOREIGN KEY (resource_id)
    REFERENCES resources (id)
    ON DELETE  CASCADE  
    NOT DEFERRABLE 
    INITIALLY IMMEDIATE
;

-- Reference: fk_booking_events_actor (table: booking_events)
ALTER TABLE booking_events ADD CONSTRAINT fk_booking_events_actor
    FOREIGN KEY (actor_user_id)
    REFERENCES users (id)
    ON DELETE  SET NULL  
    NOT DEFERRABLE 
    INITIALLY IMMEDIATE
;

-- Reference: fk_booking_events_booking (table: booking_events)
ALTER TABLE booking_events ADD CONSTRAINT fk_booking_events_booking
    FOREIGN KEY (booking_id)
    REFERENCES bookings (id)
    ON DELETE  CASCADE  
    NOT DEFERRABLE 
    INITIALLY IMMEDIATE
;

-- Reference: fk_booking_participants_booking (table: booking_participants)
ALTER TABLE booking_participants ADD CONSTRAINT fk_booking_participants_booking
    FOREIGN KEY (booking_id)
    REFERENCES bookings (id)
    ON DELETE  CASCADE  
    NOT DEFERRABLE 
    INITIALLY IMMEDIATE
;

-- Reference: fk_booking_participants_customer (table: booking_participants)
ALTER TABLE booking_participants ADD CONSTRAINT fk_booking_participants_customer
    FOREIGN KEY (customer_id)
    REFERENCES customers (id)
    ON DELETE  CASCADE  
    NOT DEFERRABLE 
    INITIALLY IMMEDIATE
;

-- Reference: fk_booking_participants_user (table: booking_participants)
ALTER TABLE booking_participants ADD CONSTRAINT fk_booking_participants_user
    FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE  CASCADE  
    NOT DEFERRABLE 
    INITIALLY IMMEDIATE
;

-- Reference: fk_booking_resources_booking (table: booking_resources)
ALTER TABLE booking_resources ADD CONSTRAINT fk_booking_resources_booking
    FOREIGN KEY (booking_id)
    REFERENCES bookings (id)
    ON DELETE  CASCADE  
    NOT DEFERRABLE 
    INITIALLY IMMEDIATE
;

-- Reference: fk_booking_resources_resource (table: booking_resources)
ALTER TABLE booking_resources ADD CONSTRAINT fk_booking_resources_resource
    FOREIGN KEY (resource_id)
    REFERENCES resources (id)
    ON DELETE  RESTRICT  
    NOT DEFERRABLE 
    INITIALLY IMMEDIATE
;

-- Reference: fk_bookings_created_by (table: bookings)
ALTER TABLE bookings ADD CONSTRAINT fk_bookings_created_by
    FOREIGN KEY (created_by_user_id)
    REFERENCES users (id)
    ON DELETE  SET NULL  
    NOT DEFERRABLE 
    INITIALLY IMMEDIATE
;

-- Reference: fk_bookings_customer (table: bookings)
ALTER TABLE bookings ADD CONSTRAINT fk_bookings_customer
    FOREIGN KEY (customer_id)
    REFERENCES customers (id)
    ON DELETE  SET NULL  
    NOT DEFERRABLE 
    INITIALLY IMMEDIATE
;

-- Reference: fk_bookings_organization (table: bookings)
ALTER TABLE bookings ADD CONSTRAINT fk_bookings_organization
    FOREIGN KEY (organization_id)
    REFERENCES organizations (id)
    ON DELETE  CASCADE  
    NOT DEFERRABLE 
    INITIALLY IMMEDIATE
;

-- Reference: fk_bookings_service (table: bookings)
ALTER TABLE bookings ADD CONSTRAINT fk_bookings_service
    FOREIGN KEY (service_id)
    REFERENCES services (id)
    ON DELETE  SET NULL  
    NOT DEFERRABLE 
    INITIALLY IMMEDIATE
;

-- Reference: fk_customers_organization (table: customers)
ALTER TABLE customers ADD CONSTRAINT fk_customers_organization
    FOREIGN KEY (organization_id)
    REFERENCES organizations (id)
    ON DELETE  CASCADE  
    NOT DEFERRABLE 
    INITIALLY IMMEDIATE
;

-- Reference: fk_resources_organization (table: resources)
ALTER TABLE resources ADD CONSTRAINT fk_resources_organization
    FOREIGN KEY (organization_id)
    REFERENCES organizations (id)
    ON DELETE  CASCADE  
    NOT DEFERRABLE 
    INITIALLY IMMEDIATE
;

-- Reference: fk_service_resources_resource (table: service_resources)
ALTER TABLE service_resources ADD CONSTRAINT fk_service_resources_resource
    FOREIGN KEY (resource_id)
    REFERENCES resources (id)
    ON DELETE  CASCADE  
    NOT DEFERRABLE 
    INITIALLY IMMEDIATE
;

-- Reference: fk_service_resources_service (table: service_resources)
ALTER TABLE service_resources ADD CONSTRAINT fk_service_resources_service
    FOREIGN KEY (service_id)
    REFERENCES services (id)
    ON DELETE  CASCADE  
    NOT DEFERRABLE 
    INITIALLY IMMEDIATE
;

-- Reference: fk_services_organization (table: services)
ALTER TABLE services ADD CONSTRAINT fk_services_organization
    FOREIGN KEY (organization_id)
    REFERENCES organizations (id)
    ON DELETE  CASCADE  
    NOT DEFERRABLE 
    INITIALLY IMMEDIATE
;

-- Reference: fk_users_organization (table: users)
ALTER TABLE users ADD CONSTRAINT fk_users_organization
    FOREIGN KEY (organization_id)
    REFERENCES organizations (id)
    ON DELETE  CASCADE  
    NOT DEFERRABLE 
    INITIALLY IMMEDIATE
;

-- Reference: resources_organizations (table: resources)
ALTER TABLE resources ADD CONSTRAINT resources_organizations
    FOREIGN KEY (organizations_id)
    REFERENCES organizations (id)  
    NOT DEFERRABLE 
    INITIALLY IMMEDIATE
;

-- End of file.

