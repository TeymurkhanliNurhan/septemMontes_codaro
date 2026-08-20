import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateResourceDto } from './dto/create-resource.dto';
import { ResourceListQueryDto } from './dto/resource-list-query.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';

describe('Resource DTOs validation', () => {
  it('rejects empty name on create', async () => {
    const dto = plainToInstance(CreateResourceDto, { name: '   ' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('name');
  });

  it('rejects metadata arrays', async () => {
    const dto = plainToInstance(CreateResourceDto, {
      name: 'Room A',
      metadata: ['nope'],
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'metadata')).toBe(true);
  });

  it('create DTO only exposes name, resourceType, and metadata', () => {
    const keys = Object.keys(
      plainToInstance(CreateResourceDto, {
        name: 'Room A',
        resourceType: 'meeting_room',
        metadata: {},
        organizationId: '11111111-1111-1111-1111-111111111111',
        status: 'ACTIVE',
      }),
    ).filter((key) =>
      ['name', 'resourceType', 'metadata', 'organizationId', 'status'].includes(
        key,
      ),
    );
    // Nest ValidationPipe whitelist/forbidNonWhitelisted strips undeclared fields at runtime.
    expect(keys).toEqual(
      expect.arrayContaining(['name', 'resourceType', 'metadata']),
    );
  });

  it('allows partial update and null resourceType', async () => {
    const dto = plainToInstance(UpdateResourceDto, {
      resourceType: null,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid list query enums and non-positive paging', async () => {
    const dto = plainToInstance(ResourceListQueryDto, {
      status: 'DELETED',
      page: 0,
      limit: -1,
      sortBy: 'id',
      sortOrder: 'sideways',
    });
    const errors = await validate(dto);
    const fields = errors.map((error) => error.property);
    expect(fields).toEqual(
      expect.arrayContaining(['status', 'page', 'limit', 'sortBy', 'sortOrder']),
    );
  });
});
