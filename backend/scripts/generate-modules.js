const fs = require('fs');
const path = require('path');

const modules = [
  {
    name: 'customer',
    route: 'customers',
    tag: 'Customer',
    entity: 'Customer',
    orgScoped: true,
    createBody: `  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;`,
  updateBody: `  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;`,
  createImports: '',
    extraImports: '',
  },
  {
    name: 'resource',
    route: 'resources',
    tag: 'Resource',
    entity: 'Resource',
    orgScoped: true,
    extraImports: "import { ResourceStatus } from '../../common/enums/resource-status.enum';",
    createBody: `  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiPropertyOptional({ enum: ResourceStatus })
  @IsOptional()
  @IsEnum(ResourceStatus)
  status?: ResourceStatus;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  organizationsId: string;`,
    updateBody: `  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: ResourceStatus })
  @IsOptional()
  @IsEnum(ResourceStatus)
  status?: ResourceStatus;`,
    createImports: 'IsEnum,',
  },
  {
    name: 'service',
    route: 'services',
    tag: 'Service',
    entity: 'Service',
    orgScoped: true,
    createBody: `  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  organizationId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  durationMinutes: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  bufferBeforeMinutes?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  bufferAfterMinutes?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;`,
    updateBody: `  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;`,
    createImports: 'IsBoolean, IsInt, Min,',
    extraImports: '',
  },
  {
    name: 'availability-rule',
    route: 'availability-rules',
    tag: 'AvailabilityRule',
    entity: 'AvailabilityRule',
    orgScoped: false,
    filterField: 'resourceId',
    createBody: `  @ApiProperty()
  @IsUUID()
  resourceId: string;

  @ApiProperty({ minimum: 0, maximum: 6 })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ example: '09:00:00' })
  @IsString()
  startTime: string;

  @ApiProperty({ example: '17:00:00' })
  @IsString()
  endTime: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;`,
    updateBody: `  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;`,
    createImports: 'IsBoolean, IsInt, Min, Max,',
    extraImports: '',
  },
  {
    name: 'availability-exception',
    route: 'availability-exceptions',
    tag: 'AvailabilityException',
    entity: 'AvailabilityException',
    orgScoped: false,
    filterField: 'resourceId',
    extraImports:
      "import { AvailabilityExceptionType } from '../../common/enums/availability-exception-type.enum';",
    createBody: `  @ApiProperty()
  @IsUUID()
  resourceId: string;

  @ApiProperty({ example: '2026-08-20' })
  @IsDateString()
  exceptionDate: string;

  @ApiProperty({ example: '09:00:00' })
  @IsString()
  startTime: string;

  @ApiProperty({ example: '12:00:00' })
  @IsString()
  endTime: string;

  @ApiProperty({ enum: AvailabilityExceptionType })
  @IsEnum(AvailabilityExceptionType)
  exceptionType: AvailabilityExceptionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;`,
    updateBody: `  @ApiPropertyOptional({ enum: AvailabilityExceptionType })
  @IsOptional()
  @IsEnum(AvailabilityExceptionType)
  exceptionType?: AvailabilityExceptionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;`,
    createImports: 'IsDateString, IsEnum,',
  },
  {
    name: 'booking',
    route: 'bookings',
    tag: 'Booking',
    entity: 'Booking',
    orgScoped: true,
    extraImports:
      "import { BookingStatus } from '../../common/enums/booking-status.enum';",
    createBody: `  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  organizationId: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiProperty()
  @IsDateString()
  startsAt: string;

  @ApiProperty()
  @IsDateString()
  endsAt: string;

  @ApiPropertyOptional({ enum: BookingStatus })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;`,
    updateBody: `  @ApiPropertyOptional({ enum: BookingStatus })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;`,
    createImports: 'IsDateString, IsEnum,',
  },
  {
    name: 'booking-event',
    route: 'booking-events',
    tag: 'BookingEvent',
    entity: 'BookingEvent',
    orgScoped: false,
    filterField: 'bookingId',
    extraImports:
      "import { BookingEventType } from '../../common/enums/booking-event-type.enum';",
    createBody: `  @ApiProperty()
  @IsUUID()
  bookingId: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @ApiProperty({ enum: BookingEventType })
  @IsEnum(BookingEventType)
  eventType: BookingEventType;`,
    updateBody: `  @ApiPropertyOptional({ enum: BookingEventType })
  @IsOptional()
  @IsEnum(BookingEventType)
  eventType?: BookingEventType;`,
    createImports: 'IsEnum,',
  },
  {
    name: 'booking-participant',
    route: 'booking-participants',
    tag: 'BookingParticipant',
    entity: 'BookingParticipant',
    orgScoped: false,
    filterField: 'bookingId',
    createBody: `  @ApiProperty()
  @IsUUID()
  bookingId: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  role?: string;`,
    updateBody: `  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  role?: string;`,
    createImports: '',
    extraImports: '',
  },
];

function pascal(s) {
  return s
    .split('-')
    .map((x) => x[0].toUpperCase() + x.slice(1))
    .join('');
}

function camel(s) {
  const p = pascal(s);
  return p[0].toLowerCase() + p.slice(1);
}

function entityFileName(name) {
  return name;
}

for (const m of modules) {
  const base = path.join('src', m.name);
  fs.mkdirSync(path.join(base, 'dto'), { recursive: true });
  const P = pascal(m.name);
  const c = camel(m.name);
  const sn = entityFileName(m.name);
  const dtoSn = m.name.split('-').pop();
  const extraImp = m.extraImports || '';

  fs.writeFileSync(
    path.join(base, 'dto', `create-${dtoSn}.dto.ts`),
    `import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ${m.createImports || ''} IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
${extraImp}

export class Create${P}Dto {
${m.createBody}

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
`,
  );

  fs.writeFileSync(
    path.join(base, 'dto', `update-${dtoSn}.dto.ts`),
    `import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ${m.createImports.includes('IsEnum') ? 'IsEnum, ' : ''}${m.createImports.includes('IsBoolean') ? 'IsBoolean, ' : ''}IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
${extraImp}

export class Update${P}Dto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id: string;

${m.updateBody}

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
`,
  );

  fs.writeFileSync(
    path.join(base, 'dto', `${dtoSn}-response.dto.ts`),
    `import { ApiProperty } from '@nestjs/swagger';
${extraImp}

export class ${P}ResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;
}
`,
  );

  const filter = m.filterField;
  let findMethod;
  if (filter) {
    findMethod = `async findByFilter(${filter}: string): Promise<${P}ResponseDto[]> {
    const items = await this.repo.find({ where: { ${filter} }, order: { createdAt: 'DESC' } });
    return items.map((item) => this.toDto(item));
  }

  async findAll(): Promise<${P}ResponseDto[]> {
    const items = await this.repo.find({ order: { createdAt: 'DESC' } });
    return items.map((item) => this.toDto(item));
  }`;
  } else if (m.orgScoped) {
    findMethod = `async findByOrganization(organizationId: string): Promise<${P}ResponseDto[]> {
    const items = await this.repo.find({ where: { organizationId }, order: { createdAt: 'DESC' } });
    return items.map((item) => this.toDto(item));
  }`;
  } else {
    findMethod = `async findAll(): Promise<${P}ResponseDto[]> {
    const items = await this.repo.find({ order: { createdAt: 'DESC' } });
    return items.map((item) => this.toDto(item));
  }`;
  }

  const createParams = m.orgScoped
    ? 'dto: Create' + P + 'Dto, organizationId?: string, createdByUserId?: string'
    : 'dto: Create' + P + 'Dto';
  const createBody = m.orgScoped
    ? `const entity = this.repo.create({
      ...dto,
      organizationId: dto.organizationId ?? organizationId,
      ...(createdByUserId && { createdByUserId }),
    } as Partial<${m.entity}>);`
    : `const entity = this.repo.create(dto as Partial<${m.entity}>);`;

  fs.writeFileSync(
    path.join(base, `${m.name}.service.ts`),
    `import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ${m.entity} } from './entities/${sn}.entity';
import { Create${P}Dto } from './dto/create-${dtoSn}.dto';
import { Update${P}Dto } from './dto/update-${dtoSn}.dto';
import { ${P}ResponseDto } from './dto/${dtoSn}-response.dto';

@Injectable()
export class ${P}Service {
  constructor(
    @InjectRepository(${m.entity})
    private readonly repo: Repository<${m.entity}>,
  ) {}

  ${findMethod}

  async findOne(id: string): Promise<${P}ResponseDto> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('${P} ' + id + ' not found');
    return this.toDto(item);
  }

  async create(${createParams}): Promise<${P}ResponseDto> {
    ${createBody}
    const saved = await this.repo.save(entity);
    return this.toDto(saved);
  }

  async update(dto: Update${P}Dto): Promise<${P}ResponseDto> {
    const entity = await this.repo.findOne({ where: { id: dto.id } });
    if (!entity) throw new NotFoundException('${P} ' + dto.id + ' not found');
    Object.assign(entity, dto);
    const saved = await this.repo.save(entity);
    return this.toDto(saved);
  }

  async remove(id: string): Promise<void> {
    const result = await this.repo.delete(id);
    if (!result.affected) throw new NotFoundException('${P} ' + id + ' not found');
  }

  private toDto(entity: ${m.entity}): ${P}ResponseDto {
    return entity as unknown as ${P}ResponseDto;
  }
}
`,
  );

  const queryExtra = filter
    ? `\n  @ApiQuery({ name: '${filter}', required: false })`
    : '';
  let findBody;
  if (m.orgScoped) {
    findBody = `const organizationId = (req.user as { organizationId: string }).organizationId;
    if (id) return this.${c}Service.findOne(id);
    return this.${c}Service.findByOrganization(organizationId);`;
  } else if (filter) {
    findBody = `if (id) return this.${c}Service.findOne(id);
    const filterValue = req.query['${filter}'] as string | undefined;
    if (filterValue) return this.${c}Service.findByFilter(filterValue);
    return this.${c}Service.findAll();`;
  } else {
    findBody = `if (id) return this.${c}Service.findOne(id);
    return this.${c}Service.findAll();`;
  }

  const postBody = m.orgScoped
    ? `const organizationId = (req.user as { organizationId: string }).organizationId;
    const user = req.user as { userId?: string; id?: string };
    const userId = user.userId ?? user.id;
    return this.${c}Service.create(dto, organizationId, userId);`
    : `return this.${c}Service.create(dto);`;

  fs.writeFileSync(
    path.join(base, `${m.name}.controller.ts`),
    `import { Body, Controller, Delete, Get, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { ${P}Service } from './${m.name}.service';
import { Create${P}Dto } from './dto/create-${dtoSn}.dto';
import { Update${P}Dto } from './dto/update-${dtoSn}.dto';
import { ${P}ResponseDto } from './dto/${dtoSn}-response.dto';

@ApiTags('${m.tag}')
@Controller('${m.route}')
@UseGuards(RolesGuard)
@ApiCookieAuth('session')
export class ${P}Controller {
  constructor(private readonly ${c}Service: ${P}Service) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'List ${m.route}' })
  @ApiQuery({ name: 'id', required: false })${queryExtra}
  @ApiResponse({ status: 200, type: [${P}ResponseDto] })
  findAll(@Req() req: Request, @Query('id') id?: string) {
    ${findBody}
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Create ${m.name}' })
  create(@Req() req: Request, @Body() dto: Create${P}Dto) {
    ${postBody}
  }

  @Patch()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  update(@Body() dto: Update${P}Dto) {
    return this.${c}Service.update(dto);
  }

  @Delete()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiQuery({ name: 'id', required: true })
  remove(@Query('id') id: string) {
    return this.${c}Service.remove(id);
  }
}
`,
  );

  fs.writeFileSync(
    path.join(base, `${m.name}.module.ts`),
    `import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ${m.entity} } from './entities/${sn}.entity';
import { ${P}Controller } from './${m.name}.controller';
import { ${P}Service } from './${m.name}.service';

@Module({
  imports: [TypeOrmModule.forFeature([${m.entity}])],
  controllers: [${P}Controller],
  providers: [${P}Service],
  exports: [${P}Service],
})
export class ${P}Module {}
`,
  );
}

const junctions = [
  {
    name: 'booking-resource',
    route: 'booking-resources',
    tag: 'BookingResource',
    entity: 'BookingResource',
    keys: ['bookingId', 'resourceId'],
  },
  {
    name: 'service-resource',
    route: 'service-resources',
    tag: 'ServiceResource',
    entity: 'ServiceResource',
    keys: ['serviceId', 'resourceId'],
  },
];

for (const j of junctions) {
  const base = path.join('src', j.name);
  fs.mkdirSync(path.join(base, 'dto'), { recursive: true });
  const P = pascal(j.name);
  const sn = entityFileName(j.name);
  const dtoSn = j.name.split('-').pop();

  fs.writeFileSync(
    path.join(base, 'dto', `create-${dtoSn}.dto.ts`),
    `import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class Create${P}Dto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ${j.keys[0]}: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ${j.keys[1]}: string;
}
`,
  );

  fs.writeFileSync(
    path.join(base, 'dto', `${dtoSn}-response.dto.ts`),
    `import { ApiProperty } from '@nestjs/swagger';

export class ${P}ResponseDto {
  @ApiProperty({ format: 'uuid' })
  ${j.keys[0]}: string;

  @ApiProperty({ format: 'uuid' })
  ${j.keys[1]}: string;
}
`,
  );

  fs.writeFileSync(
    path.join(base, `${j.name}.service.ts`),
    `import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ${j.entity} } from './entities/${sn}.entity';
import { Create${P}Dto } from './dto/create-${dtoSn}.dto';
import { ${P}ResponseDto } from './dto/${dtoSn}-response.dto';

@Injectable()
export class ${P}Service {
  constructor(
    @InjectRepository(${j.entity})
    private readonly repo: Repository<${j.entity}>,
  ) {}

  async findAll(filter?: Partial<Create${P}Dto>): Promise<${P}ResponseDto[]> {
    const items = await this.repo.find({ where: filter as object });
    return items as ${P}ResponseDto[];
  }

  async create(dto: Create${P}Dto): Promise<${P}ResponseDto> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  async remove(${j.keys[0]}: string, ${j.keys[1]}: string): Promise<void> {
    const result = await this.repo.delete({ ${j.keys[0]}, ${j.keys[1]} });
    if (!result.affected) throw new NotFoundException('Link not found');
  }
}
`,
  );

  fs.writeFileSync(
    path.join(base, `${j.name}.controller.ts`),
    `import { Body, Controller, Delete, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { ${P}Service } from './${j.name}.service';
import { Create${P}Dto } from './dto/create-${sn}.dto';

@ApiTags('${j.tag}')
@Controller('${j.route}')
@UseGuards(RolesGuard)
@ApiCookieAuth('session')
export class ${P}Controller {
  constructor(private readonly service: ${P}Service) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'List ${j.route}' })
  @ApiQuery({ name: '${j.keys[0]}', required: false })
  findAll(@Query('${j.keys[0]}') ${j.keys[0]}?: string) {
    return this.service.findAll(${j.keys[0]} ? { ${j.keys[0]} } : undefined);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  create(@Body() dto: Create${P}Dto) {
    return this.service.create(dto);
  }

  @Delete()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.STAFF)
  @ApiQuery({ name: '${j.keys[0]}', required: true })
  @ApiQuery({ name: '${j.keys[1]}', required: true })
  remove(@Query('${j.keys[0]}') ${j.keys[0]}: string, @Query('${j.keys[1]}') ${j.keys[1]}: string) {
    return this.service.remove(${j.keys[0]}, ${j.keys[1]});
  }
}
`,
  );

  fs.writeFileSync(
    path.join(base, `${j.name}.module.ts`),
    `import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ${j.entity} } from './entities/${sn}.entity';
import { ${P}Controller } from './${j.name}.controller';
import { ${P}Service } from './${j.name}.service';

@Module({
  imports: [TypeOrmModule.forFeature([${j.entity}])],
  controllers: [${P}Controller],
  providers: [${P}Service],
  exports: [${P}Service],
})
export class ${P}Module {}
`,
  );
}

console.log('Generated modules');
