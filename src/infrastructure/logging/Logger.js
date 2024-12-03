import winston from 'winston';
import path from 'path';

/**
 * 日志服务
 */
export class Logger {
    constructor(config) {
        this.config = config;
        this.logger = this.createLogger();
    }

    /**
     * 创建日志记录器
     * @private
     * @returns {winston.Logger}
     */
    createLogger() {
        const logConfig = this.config.get('logging');
        const logPath = path.resolve(process.cwd(), logConfig.file);

        return winston.createLogger({
            level: logConfig.level,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({
                    filename: logPath,
                    maxsize: 5242880, // 5MB
                    maxFiles: 5,
                    tailable: true
                }),
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                })
            ]
        });
    }

    /**
     * 记录信息级别日志
     * @param {string} message 日志消息
     * @param {Object} [meta] 元数据
     */
    info(message, meta = {}) {
        this.logger.info(message, { ...meta });
    }

    /**
     * 记录警告级别日志
     * @param {string} message 日志消息
     * @param {Object} [meta] 元数据
     */
    warn(message, meta = {}) {
        this.logger.warn(message, { ...meta });
    }

    /**
     * 记录错误级别日志
     * @param {string} message 日志消息
     * @param {Error|Object} [error] 错误对象
     * @param {Object} [meta] 元数据
     */
    error(message, error = {}, meta = {}) {
        this.logger.error(message, {
            error: error instanceof Error ? {
                message: error.message,
                stack: error.stack,
                name: error.name
            } : error,
            ...meta
        });
    }

    /**
     * 记录调试级别日志
     * @param {string} message 日志消息
     * @param {Object} [meta] 元数据
     */
    debug(message, meta = {}) {
        this.logger.debug(message, { ...meta });
    }

    /**
     * 记录HTTP请求日志
     * @param {Object} req 请求对象
     * @param {Object} res 响应对象
     * @param {number} time 处理时间
     */
    logHttpRequest(req, res, time) {
        this.info('HTTP Request', {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            responseTime: time,
            userAgent: req.get('user-agent'),
            ip: req.ip
        });
    }

    /**
     * 记录应用错误
     * @param {Error} error 错误对象
     * @param {Object} [context] 上下文信息
     */
    logError(error, context = {}) {
        this.error('Application Error', error, {
            context,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * 记录性能指标
     * @param {string} operation 操作名称
     * @param {number} duration 持续时间
     * @param {Object} [meta] 元数据
     */
    logPerformance(operation, duration, meta = {}) {
        this.info('Performance Metric', {
            operation,
            duration,
            ...meta
        });
    }

    /**
     * 记录安全事件
     * @param {string} event 事件名称
     * @param {Object} data 事件数据
     */
    logSecurityEvent(event, data = {}) {
        this.warn('Security Event', {
            event,
            ...data,
            timestamp: new Date().toISOString()
        });
    }
}
