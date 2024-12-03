import { UserRepository } from './UserRepository.js';
import { MessageRepository } from './MessageRepository.js';
import { ConversationRepository } from './ConversationRepository.js';
import { KnowledgeBaseRepository } from './KnowledgeBaseRepository.js';

/**
 * 仓储工厂类
 * 负责创建和管理所有仓储实例
 */
export class RepositoryFactory {
    /**
     * @param {any} database 数据库连接
     */
    constructor(database) {
        this.database = database;
        this._repositories = new Map();
    }

    /**
     * 获取用户仓储
     * @returns {UserRepository}
     */
    getUserRepository() {
        return this._getRepository('user', () => new UserRepository(this.database));
    }

    /**
     * 获取消息仓储
     * @returns {MessageRepository}
     */
    getMessageRepository() {
        return this._getRepository('message', () => new MessageRepository(this.database));
    }

    /**
     * 获取会话仓储
     * @returns {ConversationRepository}
     */
    getConversationRepository() {
        return this._getRepository('conversation', () => new ConversationRepository(this.database));
    }

    /**
     * 获取知识库仓储
     * @returns {KnowledgeBaseRepository}
     */
    getKnowledgeBaseRepository() {
        return this._getRepository('knowledgeBase', () => new KnowledgeBaseRepository(this.database));
    }

    /**
     * 获取或创建仓储实例
     * @private
     * @param {string} key 仓储键名
     * @param {Function} factory 仓储工厂函数
     * @returns {any}
     */
    _getRepository(key, factory) {
        if (!this._repositories.has(key)) {
            this._repositories.set(key, factory());
        }
        return this._repositories.get(key);
    }

    /**
     * 清理所有仓储实例
     */
    clearRepositories() {
        this._repositories.clear();
    }

    /**
     * 获取数据库连接
     * @returns {any}
     */
    getDatabase() {
        return this.database;
    }

    /**
     * 开启事务
     * @param {Function} operation 事务操作函数
     * @returns {Promise<any>}
     */
    async transaction(operation) {
        // 这里需要根据具体的数据库实现来处理事务
        try {
            const result = await operation();
            return result;
        } catch (error) {
            throw error;
        }
    }
}
