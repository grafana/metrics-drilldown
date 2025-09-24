import { LogLevel } from '@grafana/faro-web-sdk';

import { getFaro } from './faro/faro';
import { getEnvironment, type Environment } from './getEnvironment';

export type ErrorContext = Record<string, string>;

/**
 * Logger class that handles logging to both console and Grafana Faro.
 *
 * This class provides a unified logging interface that:
 * - Logs to console in non-production environments
 * - Sends logs to Faro for remote monitoring and error tracking
 * - Supports different log levels (trace, debug, info, log, warn, error)
 * - Handles error contexts for better error tracking
 *
 * Used throughout the application for consistent logging and error reporting.
 */

class Logger {
  #environment: Environment | null;

  constructor() {
    this.#environment = getEnvironment();
  }

  #callConsole(methodName: 'trace' | 'debug' | 'info' | 'log' | 'warn' | 'error', args: any[]) {
    // silence console in production
    if (this.#environment !== 'prod') {
      // eslint-disable-next-line no-console, no-restricted-syntax
      console[methodName](...args);
    }
  }

  trace() {
    this.#callConsole('trace', []);

    getFaro()?.api.pushLog([], {
      level: LogLevel.TRACE,
    });
  }

  debug(...args: any) {
    this.#callConsole('debug', args);

    getFaro()?.api.pushLog(args, {
      level: LogLevel.DEBUG,
    });
  }

  info(...args: any) {
    this.#callConsole('info', args);

    getFaro()?.api.pushLog(args, {
      level: LogLevel.INFO,
    });
  }

  log(...args: any) {
    this.#callConsole('log', args);

    getFaro()?.api.pushLog(args, {
      level: LogLevel.LOG,
    });
  }

  warn(...args: any) {
    this.#callConsole('warn', args);

    getFaro()?.api.pushLog(args, {
      level: LogLevel.WARN,
    });
  }

  error(error: Error, context?: ErrorContext) {
    this.#callConsole('error', [error]);

    if (context) {
      this.#callConsole('error', ['Error context', context]);
    }

    // does not report an error, but an exception ;)
    getFaro()?.api.pushError(error, {
      context,
    });
  }
}

export const logger = new Logger();
