import { Injectable, Optional, Scope, ConsoleLogger } from '@nestjs/common';
import { isErrorLike, serializeError } from 'serialize-error';
import pino, { type Logger, type LevelWithSilent } from 'pino';
import { context as otelContext, trace as otelTrace } from '@opentelemetry/api';

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

type LogFormat = 'json' | 'pretty';

const LOG_FORMATS: Array<LogFormat> = ['json', 'pretty'];
const DEFAULT_LOG_FORMAT: LogFormat = 'json';

/**
 * `json` (the default) is what every clustered/production deployment must
 * use, since log aggregators (Loki, ELK, ...) parse stdout as one JSON
 * object per line. `pretty` is opt-in, for local development only, and
 * pipes through `pino-pretty`.
 */
function resolveLogFormat(): LogFormat {
  const configuredFormat = process.env.LOG_FORMAT?.toLowerCase() as LogFormat | undefined;

  if (!configuredFormat) {
    return DEFAULT_LOG_FORMAT;
  }

  if (!LOG_FORMATS.includes(configuredFormat)) {
    console.warn(
      `Invalid LOG_FORMAT "${configuredFormat}", falling back to "${DEFAULT_LOG_FORMAT}". Valid values: ${LOG_FORMATS.join(', ')}`,
    );
    return DEFAULT_LOG_FORMAT;
  }

  return configuredFormat;
}

/**
 * Pulls `traceId`/`spanId` off the currently active OpenTelemetry span (set
 * up by `initializeTracing()`/the `@fsarch/server/register` preload), so
 * every log line emitted while a span is active can be correlated with the
 * trace it happened in. Returns an empty object outside of any span (e.g.
 * tracing disabled, or code running before/after a request).
 */
function activeTraceContext(): { traceId?: string; spanId?: string } {
  const spanContext = otelTrace.getSpanContext(otelContext.active());

  if (!spanContext) {
    return {};
  }

  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };
}

@Injectable({ scope: Scope.TRANSIENT })
export class PinoLogger extends ConsoleLogger {
  public static Instance = new PinoLogger();

  private pino: Logger;
  private section: string;

  constructor(@Optional() section?: string) {
    super();

    this.section = section || '';

    const format = resolveLogFormat();

    this.pino = pino.pino({
      level: resolveLogLevel(),
      base: undefined,
      timestamp: false,
      messageKey: 'message',
      mixin: activeTraceContext,
      transport:
        format === 'pretty'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    });
  }

  public Error(message: string, data?: Record<string, any>) {
    const logData = { ...data };
    if (logData && 'error' in logData && isErrorLike(logData.error)) {
      logData.error = serializeError(logData.error);
    }

    this.pino.error(logData, message);
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
