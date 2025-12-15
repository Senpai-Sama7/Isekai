import { trace, Span } from "@opentelemetry/api";
import { incrementActiveRequests, decrementActiveRequests, observeRequestDuration } from "./index";

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'trace';

interface LogMetadata {
  [key: string]: any;
  correlationId?: string;
  service?: string;
  traceId?: string;
  spanId?: string;
}

const levelPriority: Record<LogLevel, number> = {
  trace: 5,
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

function emit(level: LogLevel, message: string, metadata?: LogMetadata) {
  if (!shouldLog(level)) {
    return;
  }

  // Get trace context if available
  const span = trace.getActiveSpan();
  const traceContext = span ? {
    traceId: span.spanContext().traceId,
    spanId: span.spanContext().spanId,
  } : {};

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: process.env.SERVICE_NAME || 'unknown-service',
    message,
    ...traceContext,
    ...metadata,
  };

  const serialized = JSON.stringify(payload);

  switch (level) {
    case 'error':
      console.error(serialized);
      break;
    case 'warn':
      console.warn(serialized);
      break;
    case 'trace':
    case 'debug':
    case 'info':
    default:
      console.log(serialized);
  }
}

export class Logger {
  private serviceName: string;
  private defaultMetadata: LogMetadata = {};

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.defaultMetadata.service = serviceName;
  }

  withMetadata(metadata: LogMetadata): Logger {
    const newLogger = new Logger(this.serviceName);
    newLogger.defaultMetadata = { ...this.defaultMetadata, ...metadata };
    return newLogger;
  }

  trace(message: string, metadata?: LogMetadata) {
    emit('trace', message, { ...this.defaultMetadata, ...metadata });
  }

  debug(message: string, metadata?: LogMetadata) {
    emit('debug', message, { ...this.defaultMetadata, ...metadata });
  }

  info(message: string, metadata?: LogMetadata) {
    emit('info', message, { ...this.defaultMetadata, ...metadata });
  }

  warn(message: string, metadata?: LogMetadata) {
    emit('warn', message, { ...this.defaultMetadata, ...metadata });
  }

  error(message: string, metadata?: LogMetadata) {
    emit('error', message, { ...this.defaultMetadata, ...metadata });
  }

  startRequest(method: string, route: string) {
    incrementActiveRequests();
    const endTimer = observeRequestDuration({ method, route, status: 'pending' });
    
    return {
      end: (status: string) => {
        endTimer({ method, route, status });
        decrementActiveRequests();
      }
    };
  }
}

// Create default logger instance
export const logger = new Logger(process.env.SERVICE_NAME || 'backend');