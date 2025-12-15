import { Logger } from '@isekai/observability';

// Create a default logger instance
const logger = new Logger(process.env.SERVICE_NAME || 'backend');

// Export the enhanced logger - this maintains backward compatibility 
export { logger };
