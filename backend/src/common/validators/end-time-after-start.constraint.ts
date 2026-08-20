import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { HH_MM_PATTERN, isEndAfterStart } from '../utils/time';

@ValidatorConstraint({ name: 'endTimeAfterStartTime', async: false })
export class EndTimeAfterStartTimeConstraint
  implements ValidatorConstraintInterface
{
  validate(_: unknown, args: ValidationArguments): boolean {
    const obj = args.object as {
      startTime?: string;
      endTime?: string;
    };
    if (!obj.startTime || !obj.endTime) {
      return true;
    }
    if (
      !HH_MM_PATTERN.test(obj.startTime) ||
      !HH_MM_PATTERN.test(obj.endTime)
    ) {
      return true;
    }
    return isEndAfterStart(obj.startTime, obj.endTime);
  }

  defaultMessage(): string {
    return 'endTime must be after startTime';
  }
}
