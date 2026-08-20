import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource, IsNull } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Session } from '../src/auth/entities/session.entity';
import { PasswordService } from '../src/auth/services/password.service';
import { PASSWORD_MIN_LENGTH } from '../src/auth/auth.constants';
import { UserRole } from '../src/common/enums/user-role.enum';
import { Organization } from '../src/organization/entities/organization.entity';
import { User } from '../src/user/entities/user.entity';

const USAGE = `Usage:
  set-password.ts <email> <password> [--org <slug>]
  set-password.ts <email> <password> --create --org <slug> --name "Full Name" [--role OWNER]`;

interface Options {
  email: string;
  password: string;
  organizationSlug?: string;
  name?: string;
  role: UserRole;
  create: boolean;
}

function parseOptions(argv: string[]): Options {
  const [email, password, ...flags] = argv;

  if (!email || !password) {
    throw new Error(USAGE);
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    );
  }

  const options: Options = {
    email: email.trim().toLowerCase(),
    password,
    role: UserRole.OWNER,
    create: false,
  };

  for (let index = 0; index < flags.length; index += 1) {
    switch (flags[index]) {
      case '--create':
        options.create = true;
        break;
      case '--org':
        options.organizationSlug = flags[(index += 1)];
        break;
      case '--name':
        options.name = flags[(index += 1)];
        break;
      case '--role':
        options.role = parseRole(flags[(index += 1)]);
        break;
      default:
        throw new Error(`Unknown flag: ${flags[index]}\n\n${USAGE}`);
    }
  }

  if (options.create && !(options.organizationSlug && options.name)) {
    throw new Error(`--create requires --org and --name\n\n${USAGE}`);
  }

  return options;
}

function parseRole(value: string | undefined): UserRole {
  const roles = Object.values(UserRole);
  if (!value || !roles.includes(value as UserRole)) {
    throw new Error(`--role must be one of ${roles.join(', ')}`);
  }
  return value as UserRole;
}

async function findCandidates(
  dataSource: DataSource,
  options: Options,
): Promise<User[]> {
  const query = dataSource
    .getRepository(User)
    .createQueryBuilder('user')
    .leftJoinAndSelect('user.organization', 'organization')
    .where('LOWER(user.email) = :email', { email: options.email });

  if (options.organizationSlug) {
    query.andWhere('organization.slug = :slug', {
      slug: options.organizationSlug,
    });
  }

  return query.getMany();
}

async function resetPassword(
  dataSource: DataSource,
  user: User,
  passwordHash: string,
): Promise<void> {
  await dataSource.getRepository(User).update(user.id, { passwordHash });

  const revoked = await dataSource
    .getRepository(Session)
    .update(
      { userId: user.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );

  console.log(
    `Updated password for ${user.email} in "${user.organization.name}" (role ${user.role}). Revoked ${revoked.affected ?? 0} active session(s).`,
  );
}

async function createUser(
  dataSource: DataSource,
  options: Options,
  passwordHash: string,
): Promise<void> {
  await dataSource.transaction(async (manager) => {
    const organizations = manager.getRepository(Organization);
    const slug = options.organizationSlug as string;
    const name = options.name as string;

    const organization =
      (await organizations.findOne({ where: { slug } })) ??
      (await organizations.save(organizations.create({ name, slug })));

    const user = await manager.getRepository(User).save(
      manager.getRepository(User).create({
        organizationId: organization.id,
        name,
        email: options.email,
        role: options.role,
        passwordHash,
        metadata: {},
      }),
    );

    console.log(
      `Created ${options.role} ${user.email} (${user.id}) in organization "${organization.name}" (${slug}).`,
    );
  });
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const dataSource = app.get(DataSource);
    const passwordHash = await app.get(PasswordService).hash(options.password);
    const candidates = await findCandidates(dataSource, options);

    if (candidates.length > 1) {
      const slugs = candidates
        .map((candidate) => candidate.organization.slug)
        .join(', ');
      throw new Error(
        `${options.email} exists in several organizations (${slugs}). Pass --org <slug>.`,
      );
    }

    if (candidates.length === 1) {
      await resetPassword(dataSource, candidates[0], passwordHash);
      return;
    }

    if (!options.create) {
      throw new Error(
        `No user found for ${options.email}. Re-run with --create --org <slug> --name "Full Name".`,
      );
    }

    await createUser(dataSource, options, passwordHash);
  } finally {
    await app.close();
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
