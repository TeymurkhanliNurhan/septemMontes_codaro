import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AvailabilityExceptionType } from '../common/enums/availability-exception-type.enum';
import { CreateAvailabilityExceptionDto } from './dto/create-exception.dto';
import { UpdateAvailabilityExceptionDto } from './dto/update-exception.dto';

describe('AvailabilityException DTOs validation', () => {
  it('accepts UNAVAILABLE create payload', async () => {
    const dto = plainToInstance(CreateAvailabilityExceptionDto, {
      exceptionDate: '2026-08-25',
      startTime: '12:00',
      endTime: '18:00',
      exceptionType: AvailabilityExceptionType.UNAVAILABLE,
      reason: 'Maintenance',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts AVAILABLE create payload', async () => {
    const dto = plainToInstance(CreateAvailabilityExceptionDto, {
      exceptionDate: '2026-08-29',
      startTime: '10:00',
      endTime: '14:00',
      exceptionType: AvailabilityExceptionType.AVAILABLE,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid exceptionType', async () => {
    const dto = plainToInstance(CreateAvailabilityExceptionDto, {
      exceptionDate: '2026-08-25',
      startTime: '12:00',
      endTime: '18:00',
      exceptionType: 'MAYBE',
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'exceptionType')).toBe(
      true,
    );
  });

  it('rejects startTime >= endTime', async () => {
    const dto = plainToInstance(CreateAvailabilityExceptionDto, {
      exceptionDate: '2026-08-25',
      startTime: '18:00',
      endTime: '12:00',
      exceptionType: AvailabilityExceptionType.UNAVAILABLE,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects invalid exceptionDate format', async () => {
    const dto = plainToInstance(CreateAvailabilityExceptionDto, {
      exceptionDate: '25/08/2026',
      startTime: '12:00',
      endTime: '18:00',
      exceptionType: AvailabilityExceptionType.UNAVAILABLE,
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'exceptionDate')).toBe(
      true,
    );
  });

  it('rejects reason longer than 500 characters', async () => {
    const dto = plainToInstance(CreateAvailabilityExceptionDto, {
      exceptionDate: '2026-08-25',
      startTime: '12:00',
      endTime: '18:00',
      exceptionType: AvailabilityExceptionType.UNAVAILABLE,
      reason: 'x'.repeat(501),
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'reason')).toBe(true);
  });

  it('allows partial update', async () => {
    const dto = plainToInstance(UpdateAvailabilityExceptionDto, {
      reason: null,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
