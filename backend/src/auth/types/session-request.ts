import { Request } from 'express';
import { AuthUser } from '../../common/types/authenticated-request';

export interface SessionRequest extends Request {
  user?: AuthUser;
}
