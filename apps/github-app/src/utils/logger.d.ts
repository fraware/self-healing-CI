import winston from 'winston';
export declare const logger: winston.Logger;
export declare const createRequestLogger: () => winston.Logger;
export declare const createChildLogger: (context: Record<string, unknown>) => winston.Logger;
export declare const logPerformance: (operation: string, startTime: number, metadata?: Record<string, unknown>) => void;
export declare const logSecurityEvent: (event: string, details: Record<string, unknown>) => void;
export declare const logAudit: (action: string, user: string, resource: string, details?: Record<string, unknown>) => void;
export declare const logError: (error: Error, context?: Record<string, unknown>) => void;
export declare const logHttpRequest: (method: string, url: string, statusCode: number, duration: number, userAgent?: string) => void;
export default logger;
//# sourceMappingURL=logger.d.ts.map