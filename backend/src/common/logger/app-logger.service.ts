import { Injectable, LoggerService, LogLevel, Scope } from '@nestjs/common';
import { getWinstonLogger } from './winston.config';

@Injectable({ scope: Scope.TRANSIENT })
export class AppLogger implements LoggerService {
  private context?: string;
  private readonly logger = getWinstonLogger();

  setContext(context: string) {
    this.context = context;
  }

  log(message: any, context?: string) {
    this.logger.info(this.stringify(message), {
      context: context ?? this.context,
    });
  }

  error(message: any, trace?: string, context?: string) {
    const text = this.stringify(message);
    this.logger.error(trace ? `${text}\n${trace}` : text, {
      context: context ?? this.context,
    });
  }

  warn(message: any, context?: string) {
    this.logger.warn(this.stringify(message), {
      context: context ?? this.context,
    });
  }

  debug(message: any, context?: string) {
    this.logger.debug(this.stringify(message), {
      context: context ?? this.context,
    });
  }

  verbose(message: any, context?: string) {
    this.logger.verbose(this.stringify(message), {
      context: context ?? this.context,
    });
  }

  fatal(message: any, context?: string) {
    this.logger.error(this.stringify(message), {
      context: context ?? this.context,
    });
  }

  setLogLevels?(levels: LogLevel[]) {
    const order: LogLevel[] = [
      'verbose',
      'debug',
      'log',
      'warn',
      'error',
      'fatal',
    ];
    const enabled = new Set(levels);
    const lowest = order.find((level) => enabled.has(level));
    const map: Record<string, string> = {
      verbose: 'verbose',
      debug: 'debug',
      log: 'info',
      warn: 'warn',
      error: 'error',
      fatal: 'error',
    };
    if (lowest) {
      this.logger.level = map[lowest] ?? 'info';
    }
  }

  private stringify(message: any): string {
    if (typeof message === 'string') {
      return message;
    }
    if (message instanceof Error) {
      return message.stack || message.message;
    }
    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }
}
