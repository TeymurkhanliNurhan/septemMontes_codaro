import { UnauthorizedException } from '@nestjs/common';

export class MissingSessionException extends UnauthorizedException {
  constructor() {
    super('Not authenticated');
  }
}

export class InvalidSessionException extends UnauthorizedException {
  constructor() {
    super('Session expired or invalid');
  }
}
