type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const configuredLevel = (process.env.LOG_LEVEL || 'info').toLowerCase() as LogLevel;
const minPriority = levelPriority[configuredLevel] ?? levelPriority.info;

function shouldLog(level: LogLevel) {
  return levelPriority[level] >= minPriority;
}

function emit(level: LogLevel, message: string, metadata?: Record<string, unknown>) {
  if (!shouldLog(level)) {
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: 'backend',
    message,
    ...metadata,
  };

  const serialized = JSON.stringify(payload);

  if (level === 'error') {
    console.error(serialized);
  } else if (level === 'warn') {
    console.warn(serialized);
  } else {
    console.log(serialized);
  }
}

export const logger = {
  debug(message: string, metadata?: Record<string, unknown>) {
    emit('debug', message, metadata);
  },
  info(message: string, metadata?: Record<string, unknown>) {
    emit('info', message, metadata);
  },
  warn(message: string, metadata?: Record<string, unknown>) {
    emit('warn', message, metadata);
  },
  error(message: string, metadata?: Record<string, unknown>) {
    emit('error', message, metadata);
  },
};

export function withCorrelationId(meta?: Record<string, unknown>) {
  const correlationId = meta?.correlationId as string | undefined;
  return correlationId
    ? (childMeta: Record<string, unknown> = {}) => ({
        ...childMeta,
        correlationId,
      })
    : (childMeta: Record<string, unknown> = {}) => childMeta;
}
