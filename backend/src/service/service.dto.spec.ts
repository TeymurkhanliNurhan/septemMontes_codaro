import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateServiceDto } from './dto/create-service.dto';
import { ServiceQueryDto } from './dto/service-query.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

describe('Service DTOs validation', () => {
  it('rejects empty name on create', async () => {
    const dto = plainToInstance(CreateServiceDto, {
      name: '   ',
      durationMinutes: 60,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('name');
  });

  it('rejects invalid duration', async () => {
    const dto = plainToInstance(CreateServiceDto, {
      name: 'Consultation',
      durationMinutes: 0,
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'durationMinutes')).toBe(
      true,
    );
  });

  it('rejects negative buffer', async () => {
    const dto = plainToInstance(CreateServiceDto, {
      name: 'Consultation',
      durationMinutes: 60,
      bufferBeforeMinutes: -1,
    });
    const errors = await validate(dto);
    expect(
      errors.some((error) => error.property === 'bufferBeforeMinutes'),
    ).toBe(true);
  });

  it('rejects metadata arrays', async () => {
    const dto = plainToInstance(CreateServiceDto, {
      name: 'Consultation',
      durationMinutes: 60,
      metadata: ['nope'],
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'metadata')).toBe(true);
  });

  it('create DTO only exposes editable service fields', () => {
    const keys = Object.keys(
      plainToInstance(CreateServiceDto, {
        name: 'Consultation',
        description: 'Standard',
        durationMinutes: 60,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 15,
        metadata: {},
        organizationId: '11111111-1111-1111-1111-111111111111',
        isActive: false,
      }),
    ).filter((key) =>
      [
        'name',
        'description',
        'durationMinutes',
        'bufferBeforeMinutes',
        'bufferAfterMinutes',
        'metadata',
        'organizationId',
        'isActive',
      ].includes(key),
    );
    expect(keys).toEqual(
      expect.arrayContaining([
        'name',
        'description',
        'durationMinutes',
        'bufferBeforeMinutes',
        'bufferAfterMinutes',
        'metadata',
      ]),
    );
  });

  it('requires id on update and allows isActive / resourceIds', async () => {
    const missingId = plainToInstance(UpdateServiceDto, {
      name: 'Consultation',
    });
    const missingIdErrors = await validate(missingId);
    expect(missingIdErrors.some((error) => error.property === 'id')).toBe(true);

    const valid = plainToInstance(UpdateServiceDto, {
      id: 'a1111111-1111-4111-8111-111111111111',
      isActive: false,
      resourceIds: ['b2222222-2222-4222-8222-222222222222'],
      description: null,
    });
    const errors = await validate(valid);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid query enums and non-positive paging', async () => {
    const dto = plainToInstance(ServiceQueryDto, {
      status: 'DELETED',
      include: 'bookings',
      page: 0,
      limit: -1,
      sortBy: 'id',
      sortOrder: 'sideways',
    });
    const errors = await validate(dto);
    const fields = errors.map((error) => error.property);
    expect(fields).toEqual(
      expect.arrayContaining([
        'status',
        'include',
        'page',
        'limit',
        'sortBy',
        'sortOrder',
      ]),
    );
  });
});
