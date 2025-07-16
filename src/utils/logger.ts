import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

export class Logger {
  private logger: winston.Logger;
  private context: string;

  constructor(context: string = 'App') {
    this.context = context;
    this.logger = this.createLogger();
  }

  private createLogger(): winston.Logger {
    const logDir = path.join(process.cwd(), 'logs');
    
    // Ensure logs directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );

    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({
        format: 'HH:mm:ss'
      }),
      winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${level}] [${context || this.context}]: ${message} ${metaStr}`;
      })
    );

    const transports: winston.transport[] = [
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        format: logFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5
      }),
      new winston.transports.File({
        filename: path.join(logDir, 'combined.log'),
        format: logFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5
      })
    ];

    // Add console transport if not in production
    if (process.env.NODE_ENV !== 'production' || process.env.LOG_CONSOLE === 'true') {
      transports.push(
        new winston.transports.Console({
          format: consoleFormat
        })
      );
    }

    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      transports,
      exitOnError: false
    });
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, { context: this.context, ...meta });
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, { context: this.context, ...meta });
  }

  error(message: string, error?: any): void {
    const meta: any = { context: this.context };
    
    if (error) {
      if (error instanceof Error) {
        meta.error = {
          name: error.name,
          message: error.message,
          stack: error.stack
        };
      } else {
        meta.error = error;
      }
    }
    
    this.logger.error(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, { context: this.context, ...meta });
  }

  verbose(message: string, meta?: any): void {
    this.logger.verbose(message, { context: this.context, ...meta });
  }

  silly(message: string, meta?: any): void {
    this.logger.silly(message, { context: this.context, ...meta });
  }

  // Method to create child logger with additional context
  child(additionalContext: string): Logger {
    const childLogger = new Logger(`${this.context}:${additionalContext}`);
    return childLogger;
  }

  // Method to log performance metrics
  performance(operation: string, duration: number, meta?: any): void {
    this.info(`Performance: ${operation} took ${duration}ms`, {
      operation,
      duration,
      type: 'performance',
      ...meta
    });
  }

  // Method to log security events
  security(event: string, meta?: any): void {
    this.warn(`Security: ${event}`, {
      event,
      type: 'security',
      ...meta
    });
  }

  // Method to log audit events
  audit(action: string, resource: string, user?: string, meta?: any): void {
    this.info(`Audit: ${action} on ${resource}`, {
      action,
      resource,
      user,
      type: 'audit',
      ...meta
    });
  }
}