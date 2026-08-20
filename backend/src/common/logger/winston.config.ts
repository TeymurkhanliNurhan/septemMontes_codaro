import { join } from 'path';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const LOG_DIR = join(process.cwd(), 'logs');

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, context, stack }) => {
    const ctx = context ? `[${context}] ` : '';
    const base = `${timestamp} ${level.toUpperCase().padEnd(7)} ${ctx}${message}`;
    return stack ? `${base}\n${stack}` : base;
  }),
);

const onlyWarn = winston.format((info) =>
  info.level === 'warn' ? info : false,
);

let sharedLogger: winston.Logger | null = null;

export function getWinstonLogger(): winston.Logger {
  if (sharedLogger) {
    return sharedLogger;
  }

  sharedLogger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize({ all: true }),
          logFormat,
        ),
      }),
      new DailyRotateFile({
        dirname: LOG_DIR,
        filename: 'app-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: '14d',
        zippedArchive: false,
        level: 'info',
      }),
      new DailyRotateFile({
        dirname: LOG_DIR,
        filename: 'warn-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: '14d',
        zippedArchive: false,
        level: 'warn',
        format: winston.format.combine(onlyWarn(), logFormat),
      }),
      new DailyRotateFile({
        dirname: LOG_DIR,
        filename: 'error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: '30d',
        zippedArchive: false,
        level: 'error',
      }),
    ],
  });

  return sharedLogger;
}

export function getLogDirectory(): string {
  return LOG_DIR;
}
