import { ConflictException } from '@nestjs/common';
import { User } from '../../user/entities/user.entity';

export const AMBIGUOUS_ACCOUNT_CODE = 'MULTIPLE_ORGANIZATIONS';

export class AmbiguousAccountException extends ConflictException {
  constructor(candidates: User[]) {
    super({
      code: AMBIGUOUS_ACCOUNT_CODE,
      message:
        'This email belongs to several organizations. Retry with organizationId.',
      organizations: candidates.map((candidate) => ({
        id: candidate.organizationId,
        name: candidate.organization?.name ?? null,
        slug: candidate.organization?.slug ?? null,
      })),
    });
  }
}
