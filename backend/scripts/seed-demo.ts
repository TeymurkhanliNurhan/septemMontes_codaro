import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { ResourceSelectionMode } from '../src/common/enums/resource-selection-mode.enum';
import { ResourceStatus } from '../src/common/enums/resource-status.enum';
import { AvailabilityRule } from '../src/availability-rule/entities/availability-rule.entity';
import { Organization } from '../src/organization/entities/organization.entity';
import { Resource } from '../src/resource/entities/resource.entity';
import { Service } from '../src/service/entities/service.entity';
import { ServiceResource } from '../src/service-resource/entities/service-resource.entity';

const ORG_SLUG = 'demo';
const ORG_NAME = 'Demo Org';
const ORG_TIMEZONE = 'Europe/Istanbul';

// Monday-Friday. Day-of-week convention for this schema is 0 = Sunday, so
// weekdays are 1-5.
const WEEKDAYS = [1, 2, 3, 4, 5];
const WORKDAY_START = '09:00:00';
const WORKDAY_END = '17:00:00';

/**
 * Idempotent demo seed for the public booking flow, following the shape of
 * `scripts/set-password.ts`: findOrCreate at every step, safe to re-run.
 *
 * `resources.organization_id` and `resources.organizations_id` must be set to
 * the same value — `chk_resources_organization_match` (added in
 * `20260821120000-ResourceOrganizationCheck.ts`) rejects anything else.
 */
async function ensureOrganization(
  dataSource: DataSource,
): Promise<Organization> {
  const repo = dataSource.getRepository(Organization);
  const existing = await repo.findOne({ where: { slug: ORG_SLUG } });
  if (existing) {
    if (existing.timezone !== ORG_TIMEZONE) {
      existing.timezone = ORG_TIMEZONE;
      await repo.save(existing);
    }
    return existing;
  }
  return repo.save(
    repo.create({
      name: ORG_NAME,
      slug: ORG_SLUG,
      timezone: ORG_TIMEZONE,
      metadata: {},
    }),
  );
}

async function ensureResource(
  dataSource: DataSource,
  organizationId: string,
  name: string,
): Promise<Resource> {
  const repo = dataSource.getRepository(Resource);
  const existing = await repo.findOne({ where: { organizationId, name } });
  if (existing) {
    if (existing.status !== ResourceStatus.ACTIVE) {
      existing.status = ResourceStatus.ACTIVE;
      await repo.save(existing);
    }
    return existing;
  }
  return repo.save(
    repo.create({
      organizationId,
      organizationsId: organizationId,
      name,
      resourceType: null,
      status: ResourceStatus.ACTIVE,
      metadata: {},
    }),
  );
}

async function ensureAvailabilityRules(
  dataSource: DataSource,
  resourceId: string,
): Promise<void> {
  const repo = dataSource.getRepository(AvailabilityRule);
  for (const dayOfWeek of WEEKDAYS) {
    const existing = await repo.findOne({
      where: { resourceId, dayOfWeek },
    });
    if (existing) {
      existing.startTime = WORKDAY_START;
      existing.endTime = WORKDAY_END;
      existing.isActive = true;
      await repo.save(existing);
      continue;
    }
    await repo.save(
      repo.create({
        resourceId,
        dayOfWeek,
        startTime: WORKDAY_START,
        endTime: WORKDAY_END,
        timezone: null,
        isActive: true,
        metadata: {},
      }),
    );
  }
}

async function ensureService(
  dataSource: DataSource,
  organizationId: string,
  name: string,
  durationMinutes: number,
  resourceSelectionMode: ResourceSelectionMode,
): Promise<Service> {
  const repo = dataSource.getRepository(Service);
  const existing = await repo.findOne({ where: { organizationId, name } });
  if (existing) {
    existing.durationMinutes = durationMinutes;
    existing.resourceSelectionMode = resourceSelectionMode;
    existing.isActive = true;
    await repo.save(existing);
    return existing;
  }
  return repo.save(
    repo.create({
      organizationId,
      name,
      description: null,
      durationMinutes,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      isActive: true,
      resourceSelectionMode,
      metadata: {},
    }),
  );
}

async function ensureServiceResource(
  dataSource: DataSource,
  serviceId: string,
  resourceId: string,
): Promise<void> {
  const repo = dataSource.getRepository(ServiceResource);
  const existing = await repo.findOne({ where: { serviceId, resourceId } });
  if (existing) return;
  await repo.save(repo.create({ serviceId, resourceId }));
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const dataSource = app.get(DataSource);

    const organization = await ensureOrganization(dataSource);
    console.log(`Organization "${organization.slug}" (${organization.id})`);

    const roomA = await ensureResource(dataSource, organization.id, 'Room A');
    const roomB = await ensureResource(dataSource, organization.id, 'Room B');
    console.log(
      `Resources: ${roomA.name} (${roomA.id}), ${roomB.name} (${roomB.id})`,
    );

    for (const resource of [roomA, roomB]) {
      await ensureAvailabilityRules(dataSource, resource.id);
    }
    console.log(
      'Availability rules: weekdays 1-5, 09:00-17:00 on both resources',
    );

    const consultation = await ensureService(
      dataSource,
      organization.id,
      'Consultation',
      60,
      ResourceSelectionMode.AUTO,
    );
    const haircut = await ensureService(
      dataSource,
      organization.id,
      'Haircut',
      30,
      ResourceSelectionMode.CUSTOMER_CHOICE,
    );
    console.log(
      `Services: ${consultation.name} (${consultation.id}, AUTO), ${haircut.name} (${haircut.id}, CUSTOMER_CHOICE)`,
    );

    for (const service of [consultation, haircut]) {
      for (const resource of [roomA, roomB]) {
        await ensureServiceResource(dataSource, service.id, resource.id);
      }
    }
    console.log('Linked both services to both resources.');

    console.log('Seed complete.');
  } finally {
    await app.close();
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
