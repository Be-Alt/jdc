import { getOptionalEnv } from './env.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogContext = Record<string, unknown>;

const levelWeight: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function getConfiguredLevel(): LogLevel {
  const value = getOptionalEnv('LOG_LEVEL')?.toLowerCase();

  if (value === 'debug' || value === 'info' || value === 'warn' || value === 'error') {
    return value;
  }

  return 'info';
}

function shouldLog(level: LogLevel): boolean {
  return levelWeight[level] >= levelWeight[getConfiguredLevel()];
}

function serializeError(error: unknown): LogContext | unknown {
  if (!(error instanceof Error)) {
    return error;
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack
  };
}

function write(level: LogLevel, event: string, context?: LogContext): void {
  if (!shouldLog(level)) {
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(context ?? {})
  };

  const line = JSON.stringify(payload);

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}

export const logger = {
  debug(event: string, context?: LogContext) {
    write('debug', event, context);
  },
  info(event: string, context?: LogContext) {
    write('info', event, context);
  },
  warn(event: string, context?: LogContext) {
    write('warn', event, context);
  },
  error(event: string, error: unknown, context?: LogContext) {
    write('error', event, {
      ...(context ?? {}),
      error: serializeError(error)
    });
  }
};
