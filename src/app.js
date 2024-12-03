import { Container } from './infrastructure/di/Container.js';
import { Configuration } from './config/Configuration.js';
import { Database } from './infrastructure/database/Database.js';
import { EventEmitter } from './infrastructure/events/EventEmitter.js';
import { Logger } from './infrastructure/logging/Logger.js';
import { UserService } from './domain/services/user/UserService.js';
import { ConversationService } from './domain/services/conversation/ConversationService.js';
import { KnowledgeService } from './domain/services/knowledge/KnowledgeService.js';
import { ChatApplicationService } from './application/services/ChatApplicationService.js';

/**
 * 应用程序类
 */
export class Application {
    constructor() {
        this.container = new Container();
        this.initialized = false;
    }

    /**
     * 初始化应用
     */
    async initialize() {
        if (this.initialized) {
            return;
        }

        try {
            // 1. 初始化配置
            const config = new Configuration();
            if (!config.validate()) {
                throw new Error('Invalid configuration');
            }
            this.container.registerConfig(config);

            // 2. 注册基础设施服务
            this.container.register('logger', (config) => new Logger(config), true);
            this.container.register('database', (config) => new Database(config), true);
            this.container.register('eventEmitter', () => new EventEmitter(), true);

            // 3. 注册领域服务
            this.container.register('userService', 
                (database, eventEmitter) => new UserService(database, eventEmitter));
            this.container.register('conversationService',
                (database, eventEmitter) => new ConversationService(database, eventEmitter));
            this.container.register('knowledgeService',
                (database, config) => new KnowledgeService(database, config));

            // 4. 注册应用服务
            this.container.register('chatService',
                (userService, conversationService, knowledgeService, eventEmitter, config) =>
                    new ChatApplicationService({
                        userService,
                        conversationService,
                        knowledgeService,
                        eventEmitter,
                        config
                    }), true);

            // 5. 初始化数据库连接
            const database = this.container.resolve('database');
            await database.initialize();

            // 6. 设置事件监听器
            this.setupEventListeners();

            this.initialized = true;
            const logger = this.container.resolve('logger');
            logger.info('Application initialized successfully');
        } catch (error) {
            const logger = this.container.resolve('logger');
            logger.error('Failed to initialize application', error);
            throw error;
        }
    }

    /**
     * 设置事件监听器
     * @private
     */
    setupEventListeners() {
        const eventEmitter = this.container.resolve('eventEmitter');
        const logger = this.container.resolve('logger');

        // 用户相关事件
        eventEmitter.on('user:created', (data) => {
            logger.info('New user created', { userId: data.userId });
        });

        eventEmitter.on('user:settings:updated', (data) => {
            logger.info('User settings updated', {
                userId: data.userId,
                preferences: data.preferences
            });
        });

        // 会话相关事件
        eventEmitter.on('chat:message:processed', (data) => {
            logger.info('Chat message processed', {
                userId: data.userId,
                conversationId: data.conversationId
            });
        });

        eventEmitter.on('conversation:created', (data) => {
            logger.info('New conversation created', {
                conversationId: data.conversationId,
                userId: data.userId
            });
        });

        // 错误事件
        eventEmitter.on('error', (error) => {
            logger.error('Application error occurred', error);
        });
    }

    /**
     * 获取服务实例
     * @param {string} name 服务名称
     * @returns {*} 服务实例
     */
    getService(name) {
        return this.container.resolve(name);
    }

    /**
     * 关闭应用
     */
    async shutdown() {
        try {
            const logger = this.container.resolve('logger');
            logger.info('Shutting down application...');

            // 关闭数据库连接
            const database = this.container.resolve('database');
            await database.close();

            // 清理事件监听器
            const eventEmitter = this.container.resolve('eventEmitter');
            eventEmitter.removeAllListeners();

            // 清理容器
            this.container.clear();
            this.initialized = false;

            logger.info('Application shutdown complete');
        } catch (error) {
            const logger = this.container.resolve('logger');
            logger.error('Error during application shutdown', error);
            throw error;
        }
    }
}

// 创建应用实例
const app = new Application();
export default app;
