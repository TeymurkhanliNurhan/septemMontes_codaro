import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAvailabilityRuleDto } from './dto/create-rule.dto';
import { UpdateAvailabilityRuleDto } from './dto/update-rule.dto';

describe('AvailabilityRule DTOs validation', () => {
  it('accepts a valid create payload', async () => {
    const dto = plainToInstance(CreateAvailabilityRuleDto, {
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '18:00',
      timezone: 'Europe/Warsaw',
      metadata: {},
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid dayOfWeek', async () => {
    const dto = plainToInstance(CreateAvailabilityRuleDto, {
      dayOfWeek: 7,
      startTime: '09:00',
      endTime: '18:00',
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'dayOfWeek')).toBe(true);
  });

  it('rejects startTime >= endTime', async () => {
    const dto = plainToInstance(CreateAvailabilityRuleDto, {
      dayOfWeek: 1,
      startTime: '18:00',
      endTime: '09:00',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects invalid HH:mm times', async () => {
    const dto = plainToInstance(CreateAvailabilityRuleDto, {
      dayOfWeek: 1,
      startTime: '9am',
      endTime: '18:00',
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'startTime')).toBe(true);
  });

  it('rejects metadata arrays', async () => {
    const dto = plainToInstance(CreateAvailabilityRuleDto, {
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '18:00',
      metadata: ['nope'],
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'metadata')).toBe(true);
  });

  it('allows partial update including nullable timezone', async () => {
    const dto = plainToInstance(UpdateAvailabilityRuleDto, {
      timezone: null,
      isActive: false,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
