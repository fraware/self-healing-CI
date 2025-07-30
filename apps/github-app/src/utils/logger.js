import path from 'path';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
// Custom log levels
const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6,
};
// Custom colors for different log levels
const logColors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
    trace: 'cyan',
};
// Add colors to winston
winston.addColors(logColors);
// Structured format for production
const structuredFormat = winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json(), winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const base = {
        timestamp,
        level,
        message,
        ...meta,
    };
    if (stack) {
        base.stack = stack;
    }
    return JSON.stringify(base);
}));
// Console format for development
const consoleFormat = winston.format.combine(winston.format.colorize({ all: true }), winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS',
}), winston.format.errors({ stack: true }), winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
        log += ` ${JSON.stringify(meta)}`;
    }
    if (stack) {
        log += `\n${stack}`;
    }
    return log;
}));
// Create transports
const createTransports = () => {
    const transports = [];
    const env = process.env;
    // Console transport for development
    if (env.NODE_ENV !== 'production') {
        transports.push(new winston.transports.Console({
            level: env.LOG_LEVEL || 'debug',
            format: consoleFormat,
        }));
    }
    // File transports for production
    if (env.NODE_ENV === 'production') {
        // Error log file
        transports.push(new DailyRotateFile({
            filename: path.join('logs', 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            format: structuredFormat,
            maxSize: '20m',
            maxFiles: '14d',
            zippedArchive: true,
        }));
        // Combined log file
        transports.push(new DailyRotateFile({
            filename: path.join('logs', 'combined-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            format: structuredFormat,
            maxSize: '20m',
            maxFiles: '14d',
            zippedArchive: true,
        }));
        // HTTP log file
        transports.push(new DailyRotateFile({
            filename: path.join('logs', 'http-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            level: 'http',
            format: structuredFormat,
            maxSize: '20m',
            maxFiles: '7d',
            zippedArchive: true,
        }));
    }
    return transports;
};
// Create the logger instance
export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    levels: logLevels,
    format: structuredFormat,
    transports: createTransports(),
    exitOnError: false,
    silent: process.env.NODE_ENV === 'test',
});
// Add request logging middleware
export const createRequestLogger = () => {
    return winston.createLogger({
        level: 'http',
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        transports: [
            new DailyRotateFile({
                filename: path.join('logs', 'requests-%DATE%.log'),
                datePattern: 'YYYY-MM-DD',
                maxSize: '20m',
                maxFiles: '7d',
                zippedArchive: true,
            }),
        ],
    });
};
// Create a child logger with additional context
export const createChildLogger = (context) => {
    return logger.child(context);
};
// Log uncaught exceptions and unhandled rejections
logger.exceptions.handle(new DailyRotateFile({
    filename: path.join('logs', 'exceptions-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    zippedArchive: true,
}));
logger.rejections.handle(new DailyRotateFile({
    filename: path.join('logs', 'rejections-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    zippedArchive: true,
}));
// Performance logging utility
export const logPerformance = (operation, startTime, metadata) => {
    const duration = Date.now() - startTime;
    logger.info(`Performance: ${operation} completed`, {
        operation,
        durationMs: duration,
        ...metadata,
    });
};
// Security logging utility
export const logSecurityEvent = (event, details) => {
    logger.warn(`Security Event: ${event}`, {
        securityEvent: event,
        ...details,
        timestamp: new Date().toISOString(),
    });
};
// Audit logging utility
export const logAudit = (action, user, resource, details) => {
    logger.info(`Audit: ${action}`, {
        auditAction: action,
        auditUser: user,
        auditResource: resource,
        ...details,
        timestamp: new Date().toISOString(),
    });
};
// Error logging with context
export const logError = (error, context) => {
    logger.error(`Error: ${error.message}`, {
        error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
        },
        ...context,
    });
};
// HTTP request logging
export const logHttpRequest = (method, url, statusCode, duration, userAgent) => {
    logger.http(`HTTP ${method} ${url}`, {
        method,
        url,
        statusCode,
        durationMs: duration,
        userAgent,
    });
};
// Export default logger
export default logger;
//# sourceMappingURL=logger.js.map