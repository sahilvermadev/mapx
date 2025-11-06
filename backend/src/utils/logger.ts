import winston from 'winston';
import path from 'path';

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development (more readable)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta, null, 2)}`;
    }
    return msg;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'mapx-backend' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: isProduction ? logFormat : consoleFormat,
    }),
  ],
});

// In production, also write logs to file
if (isProduction) {
  // Ensure logs directory exists
  const logsDir = path.resolve(__dirname, '../../logs');
  
  // Error logs
  logger.add(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: logFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  // Combined logs
  logger.add(
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: logFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

/**
 * Logger utility with request context support
 */
export const log = {
  error: (message: string, meta?: any) => {
    logger.error(message, meta);
  },
  warn: (message: string, meta?: any) => {
    logger.warn(message, meta);
  },
  info: (message: string, meta?: any) => {
    logger.info(message, meta);
  },
  debug: (message: string, meta?: any) => {
    logger.debug(message, meta);
  },
  // Request logging helper
  request: (req: any, res?: any, duration?: number) => {
    const meta: any = {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };

    if (req.requestId) {
      meta.requestId = req.requestId;
    }

    if (req.user?.id) {
      meta.userId = req.user.id;
    }

    if (duration !== undefined) {
      meta.duration = `${duration}ms`;
    }

    if (res?.statusCode) {
      meta.statusCode = res.statusCode;
    }

    logger.info('HTTP Request', meta);
  },
};

export default logger;

