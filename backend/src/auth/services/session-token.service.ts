import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { createHmac, randomBytes } from 'crypto';
import sessionConfig from '../config/session.config';

const TOKEN_BYTES = 32;
const HASH_ALGORITHM = 'sha256';

@Injectable()
export class SessionTokenService {
  constructor(
    @Inject(sessionConfig.KEY)
    private readonly config: ConfigType<typeof sessionConfig>,
  ) {}

  generate(): string {
    return randomBytes(TOKEN_BYTES).toString('base64url');
  }

  hash(token: string): string {
    return createHmac(HASH_ALGORITHM, this.config.pepper)
      .update(token)
      .digest('hex');
  }
}
