import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import sessionConfig from '../config/session.config';

const EQUALIZING_HASH =
  '$2b$12$C6UzMDM.H6dfI/f/IKcEe.eLcVs.wLQhAqB1nJdcgQ.pXqAqXvTgO';

@Injectable()
export class PasswordService {
  constructor(
    @Inject(sessionConfig.KEY)
    private readonly config: ConfigType<typeof sessionConfig>,
  ) {}

  hash(plaintext: string): Promise<string> {
    return bcrypt.hash(plaintext, this.config.bcryptRounds);
  }

  async verify(plaintext: string, hash: string | null): Promise<boolean> {
    if (hash === null) {
      await bcrypt.compare(plaintext, EQUALIZING_HASH);
      return false;
    }
    return bcrypt.compare(plaintext, hash);
  }
}
