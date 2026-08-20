import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from '../../auth/dto/login.dto';
import { CreateUserDto } from '../../user/dto/create-user.dto';
import { UpdateUserDto } from '../../user/dto/update-user.dto';

describe('NormalizeEmail', () => {
  describe('on LoginDto', () => {
    const parse = (email: unknown): LoginDto =>
      plainToInstance(LoginDto, { email, password: 'QaLogin!2026' });

    it('trims surrounding whitespace', async () => {
      const dto = parse('  berkay@example.com  ');
      expect(dto.email).toBe('berkay@example.com');
      await expect(validate(dto)).resolves.toEqual([]);
    });

    it('lowercases the address', async () => {
      const dto = parse('BERKAY@EXAMPLE.COM');
      expect(dto.email).toBe('berkay@example.com');
      await expect(validate(dto)).resolves.toEqual([]);
    });

    it('leaves a value that is not a string for the validator to reject', async () => {
      const dto = parse(42);
      const errors = await validate(dto);
      expect(errors.map((error) => error.property)).toContain('email');
    });

    it('still rejects an address that is malformed after trimming', async () => {
      const errors = await validate(parse('  not-an-email  '));
      expect(errors.map((error) => error.property)).toContain('email');
    });
  });

  it('normalizes the address a user is created with', () => {
    const dto = plainToInstance(CreateUserDto, {
      name: 'Berkay Bayar',
      email: '  Berkay@Example.com ',
    });
    expect(dto.email).toBe('berkay@example.com');
  });

  it('normalizes the address a user is renamed to', () => {
    const dto = plainToInstance(UpdateUserDto, {
      id: '00000000-0000-4000-8000-000000000000',
      email: '  Berkay@Example.com ',
    });
    expect(dto.email).toBe('berkay@example.com');
  });

  it('leaves an omitted address alone', () => {
    const dto = plainToInstance(UpdateUserDto, {
      id: '00000000-0000-4000-8000-000000000000',
    });
    expect(dto.email).toBeUndefined();
  });
});
