import { AbstractLogger, type LogLevel, type LogMessage } from 'typeorm';
import type { QueryRunner } from 'typeorm';
import { PinoLogger } from '../logger/pino-logger.service.js';

/**
 * Routes TypeORM's own logging (queries, query errors, slow queries, schema
 * build, migrations) through `PinoLogger` instead of TypeORM's default
 * console loggers, which write straight to `console.log`/`console.warn` and
 * bypass pino entirely (no JSON formatting, no trace/span correlation).
 *
 * Only implements `writeLog()` — `AbstractLogger` already does the
 * `logging: [...]` option filtering (`isLogEnabledFor`) and message
 * preparation (`prepareLogMessages`), so this just maps the prepared
 * messages onto the right `PinoLogger` level.
 */
export class TypeOrmPinoLogger extends AbstractLogger {
  private readonly logger = new PinoLogger('typeorm');

  protected writeLog(
    level: LogLevel,
    logMessage: LogMessage | string | number | Array<LogMessage | string | number>,
    queryRunner?: QueryRunner,
  ): void {
    // highlightSql defaults to true and wraps the SQL in ANSI escape codes,
    // which is only useful for a terminal, not for a structured/JSON log line.
    const messages = this.prepareLogMessages(logMessage, {
      highlightSql: false,
    });

    for (const message of messages) {
      const text = message.prefix
        ? `${message.prefix} ${message.message}`
        : String(message.message);
      const data = message.additionalInfo;

      switch (message.type ?? level) {
        case 'query-error':
        case 'error':
          this.logger.error(text, data);
          break;
        case 'query-slow':
        case 'warn':
          this.logger.warn(text, data);
          break;
        case 'migration':
        case 'schema-build':
        case 'log':
        case 'info':
        case 'query':
        default:
          this.logger.log(text, data);
          break;
      }
    }
  }
}
