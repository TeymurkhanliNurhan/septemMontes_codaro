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

/**
 * Seeds the Septem Funeral demo: a funeral home whose bookable units are the
 * steps of a funeral (preparation, viewing, service, transport, committal)
 * rather than standalone appointments.
 *
 * Two things differ from an ordinary booking seed and both are deliberate:
 *
 *  - Availability runs every day of the week, 07:00-21:00. Death does not
 *    observe office hours, and the chain solver needs room to place five
 *    dependent steps inside a window that religious law may cap at 24 hours.
 *  - Resources carry a `resource_type`, which is what the frontend groups the
 *    timeline rows by. Cold storage is a resource like any other here; the
 *    difference is that the UI holds it for the whole case rather than for one
 *    step's duration.
 *
 * Idempotent at every step, same as `seed-demo.ts` — safe to re-run.
 */

const ORG_SLUG = 'septem';
const ORG_NAME = 'Septem Funeral';
const ORG_TIMEZONE = 'Europe/Warsaw';

// 0 = Sunday in this schema, so every day is 0-6. A funeral home does not
// close on Saturday.
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DAY_START = '07:00:00';
const DAY_END = '21:00:00';

/** Resource types the timeline groups rows by. */
const TYPE = {
  PREP_ROOM: 'PREP_ROOM',
  COLD_STORAGE: 'COLD_STORAGE',
  CHAPEL: 'CHAPEL',
  HEARSE: 'HEARSE',
  CELEBRANT: 'CELEBRANT',
  COMMITTAL: 'COMMITTAL',
} as const;

interface ResourceSpec {
  name: string;
  type: string;
  /** Shown on the director console; free text, not load-bearing. */
  note?: string;
}

const RESOURCES: ResourceSpec[] = [
  { name: 'Preparation Room', type: TYPE.PREP_ROOM },
  { name: 'Cold Storage Bay 1', type: TYPE.COLD_STORAGE },
  { name: 'Cold Storage Bay 2', type: TYPE.COLD_STORAGE },
  { name: 'Cold Storage Bay 3', type: TYPE.COLD_STORAGE },
  { name: 'Chapel of Rest', type: TYPE.CHAPEL, note: 'Seats 80' },
  { name: 'Small Chapel', type: TYPE.CHAPEL, note: 'Seats 24' },
  { name: 'Hearse — Warsaw', type: TYPE.HEARSE },
  { name: 'Hearse — Reserve', type: TYPE.HEARSE },
  { name: 'Celebrant on call', type: TYPE.CELEBRANT },
  {
    name: 'Bródno Cemetery — plot',
    type: TYPE.COMMITTAL,
    note: 'Third party — slots confirmed by the cemetery office',
  },
  {
    name: 'Northern Crematorium — retort',
    type: TYPE.COMMITTAL,
    note: 'Third party — two retorts, high demand',
  },
];

interface StepSpec {
  name: string;
  description: string;
  durationMinutes: number;
  /** Resource names this step may run on. */
  resources: string[];
  /** Ordering hint the frontend chain solver reads back off `metadata`. */
  step: number;
}

/**
 * The chain. `metadata.step` is the ordering the frontend solves against, and
 * `metadata.chainRole` names what the step is for so the UI can label a row
 * without matching on service names.
 */
const STEPS: StepSpec[] = [
  {
    name: 'Preparation',
    description:
      'Washing, dressing and preparation of the deceased. Must be completed before any viewing.',
    durationMinutes: 120,
    resources: ['Preparation Room'],
    step: 1,
  },
  {
    name: 'Viewing',
    description:
      'Private time for the family with the deceased, in a chapel of rest.',
    durationMinutes: 60,
    resources: ['Chapel of Rest', 'Small Chapel'],
    step: 2,
  },
  {
    name: 'Funeral Service',
    description: 'The service itself, led by a celebrant or the family clergy.',
    durationMinutes: 60,
    resources: ['Chapel of Rest', 'Small Chapel'],
    step: 3,
  },
  {
    name: 'Transport',
    description:
      'Hearse and bearers, from the chapel to the place of committal.',
    durationMinutes: 60,
    resources: ['Hearse — Warsaw', 'Hearse — Reserve'],
    step: 4,
  },
  {
    name: 'Committal',
    description:
      'Burial or cremation. Held at a third-party site, so the slot is theirs to confirm, not ours.',
    durationMinutes: 60,
    resources: ['Bródno Cemetery — plot', 'Northern Crematorium — retort'],
    step: 5,
  },
];

async function ensureOrganization(
  dataSource: DataSource,
): Promise<Organization> {
  const repo = dataSource.getRepository(Organization);
  const existing = await repo.findOne({ where: { slug: ORG_SLUG } });
  if (existing) {
    existing.name = ORG_NAME;
    existing.timezone = ORG_TIMEZONE;
    return repo.save(existing);
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

/**
 * `resources.organization_id` and `resources.organizations_id` must hold the
 * same value — `chk_resources_organization_match` rejects anything else.
 */
async function ensureResource(
  dataSource: DataSource,
  organizationId: string,
  spec: ResourceSpec,
): Promise<Resource> {
  const repo = dataSource.getRepository(Resource);
  const metadata = spec.note ? { note: spec.note } : {};
  const existing = await repo.findOne({
    where: { organizationId, name: spec.name },
  });
  if (existing) {
    existing.resourceType = spec.type;
    existing.status = ResourceStatus.ACTIVE;
    existing.metadata = metadata;
    return repo.save(existing);
  }
  return repo.save(
    repo.create({
      organizationId,
      organizationsId: organizationId,
      name: spec.name,
      resourceType: spec.type,
      status: ResourceStatus.ACTIVE,
      metadata,
    }),
  );
}

async function ensureAvailabilityRules(
  dataSource: DataSource,
  resourceId: string,
): Promise<void> {
  const repo = dataSource.getRepository(AvailabilityRule);
  for (const dayOfWeek of ALL_DAYS) {
    const existing = await repo.findOne({ where: { resourceId, dayOfWeek } });
    if (existing) {
      existing.startTime = DAY_START;
      existing.endTime = DAY_END;
      existing.isActive = true;
      await repo.save(existing);
      continue;
    }
    await repo.save(
      repo.create({
        resourceId,
        dayOfWeek,
        startTime: DAY_START,
        endTime: DAY_END,
        timezone: null,
        isActive: true,
        metadata: {},
      }),
    );
  }
}

async function ensureStep(
  dataSource: DataSource,
  organizationId: string,
  spec: StepSpec,
): Promise<Service> {
  const repo = dataSource.getRepository(Service);
  const metadata = { step: spec.step, chainRole: spec.name.toUpperCase() };
  const existing = await repo.findOne({
    where: { organizationId, name: spec.name },
  });
  if (existing) {
    existing.description = spec.description;
    existing.durationMinutes = spec.durationMinutes;
    // Every step is CUSTOMER_CHOICE so the public API will name the resources
    // the family's plan is built from. An AUTO service hides them, and this UI
    // has to show which chapel and which hearse a plan uses.
    existing.resourceSelectionMode = ResourceSelectionMode.CUSTOMER_CHOICE;
    existing.isActive = true;
    existing.metadata = metadata;
    return repo.save(existing);
  }
  return repo.save(
    repo.create({
      organizationId,
      name: spec.name,
      description: spec.description,
      durationMinutes: spec.durationMinutes,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      isActive: true,
      resourceSelectionMode: ResourceSelectionMode.CUSTOMER_CHOICE,
      metadata,
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

    const byName = new Map<string, Resource>();
    for (const spec of RESOURCES) {
      const resource = await ensureResource(dataSource, organization.id, spec);
      byName.set(spec.name, resource);
      await ensureAvailabilityRules(dataSource, resource.id);
    }
    console.log(
      `Resources: ${RESOURCES.length}, every day ${DAY_START}-${DAY_END}`,
    );

    for (const spec of STEPS) {
      const service = await ensureStep(dataSource, organization.id, spec);
      for (const resourceName of spec.resources) {
        const resource = byName.get(resourceName);
        if (!resource) throw new Error(`Unknown resource: ${resourceName}`);
        await ensureServiceResource(dataSource, service.id, resource.id);
      }
      console.log(
        `Step ${spec.step}. ${spec.name} (${service.id}) — ${spec.resources.join(', ')}`,
      );
    }

    console.log('Seed complete.');
  } finally {
    await app.close();
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
