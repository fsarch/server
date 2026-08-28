import { Injectable, Optional, Scope, ConsoleLogger } from '@nestjs/common';
import { isErrorLike, serializeError } from 'serialize-error';
import pino, { type Logger, type LevelWithSilent } from 'pino';

const LOG_LEVELS: Array<LevelWithSilent> = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'silent',
];
const DEFAULT_LOG_LEVEL: LevelWithSilent = 'warn';

function resolveLogLevel(): LevelWithSilent {
  const configuredLevel = process.env.LOG_LEVEL?.toLowerCase() as LevelWithSilent | undefined;

  if (!configuredLevel) {
    return DEFAULT_LOG_LEVEL;
  }

  if (!LOG_LEVELS.includes(configuredLevel)) {
    console.warn(
      `Invalid LOG_LEVEL "${configuredLevel}", falling back to "${DEFAULT_LOG_LEVEL}". Valid values: ${LOG_LEVELS.join(', ')}`,
    );
    return DEFAULT_LOG_LEVEL;
  }

  return configuredLevel;
}

@Injectable({ scope: Scope.TRANSIENT })
export class PinoLogger extends ConsoleLogger {
  public static Instance = new PinoLogger();

  private pino: Logger;
  private section: string;

  constructor(@Optional() section?: string) {
    super();

    this.section = section || '';

    this.pino = pino.pino({
      level: resolveLogLevel(),
      base: undefined,
      timestamp: false,
      messageKey: 'message',
    });
  }

  public Error(message: string, data?: Record<string, any>) {
    const logData = { ...data };
    if (logData && 'error' in logData && isErrorLike(logData.error)) {
      logData.error = serializeError(logData.error);
    }

    console.error(
      JSON.stringify({
        message,
        data,
      }),
    );
  }

  public log(message: any, ...args: any[]) {
    const context = this.section ?? args.pop();
    const data = args.shift();

    this.pino.info(
      {
        payload: data,
        section: context,
      },
      message,
    );
  }

  public error(message: any, ...args: any[]) {
    const context = this.section ?? args.pop();
    const data = args.shift();

    const logData: Record<string, unknown> = {
      payload: data,
      section: context,
      args,
    };

    if (message instanceof Error) {
      logData.error = serializeError(message);
      message = message.message;
    }

    this.pino.error(
      logData,
      message,
    );
  }

  public warn(message: any, ...args: any[]) {
    const context = this.section ?? args.pop();
    const data = args.shift();

    this.pino.warn(
      {
        payload: data,
        section: context,
      },
      message,
    );
  }

  public debug(message: any, ...args: any[]) {
    const context = this.section ?? args.pop();
    const data = args.shift();

    this.pino.debug(
      {
        payload: data,
        section: context,
      },
      message,
    );
  }

  public verbose(message: any, ...args: any[]) {
    const context = this.section ?? args.pop();
    const data = args.shift();

    this.pino.trace(
      {
        payload: data,
        section: context,
      },
      message,
    );
  }

  public critical(message: any, ...args: any[]) {
    const context = this.section ?? args.pop();
    const data = args.shift();

    this.pino.fatal(
      {
        payload: data,
        section: context,
      },
      message,
    );
  }
}
