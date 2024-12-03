import { BaseRepository } from './BaseRepository.js';
import { Message } from '../../domain/models/conversation/Message.js';

/**
 * 消息仓储实现类
 * @extends {BaseRepository<Message>}
 */
export class MessageRepository extends BaseRepository {
    /**
     * @param {any} database 数据库连接
     */
    constructor(database) {
        super('messages', database);
    }

    /**
     * 根据会话ID查找消息
     * @param {string} conversationId 会话ID
     * @returns {Promise<Message[]>}
     */
    async findByConversationId(conversationId) {
        return this.findAll({ conversationId });
    }

    /**
     * 根据用户ID查找消息
     * @param {string} userId 用户ID
     * @returns {Promise<Message[]>}
     */
    async findByUserId(userId) {
        return this.findAll({ userId });
    }

    /**
     * 根据消息类型查找消息
     * @param {string} type 消息类型
     * @returns {Promise<Message[]>}
     */
    async findByType(type) {
        return this.findAll({ type });
    }

    /**
     * 查找指定时间范围内的消息
     * @param {Date} startTime 开始时间
     * @param {Date} endTime 结束时间
     * @returns {Promise<Message[]>}
     */
    async findByTimeRange(startTime, endTime) {
        return this.findAll(entity => {
            const timestamp = entity.metadata.timestamp;
            return timestamp >= startTime && timestamp <= endTime;
        });
    }

    /**
     * 获取会话中的最后一条消息
     * @param {string} conversationId 会话ID
     * @returns {Promise<Message|null>}
     */
    async getLastMessage(conversationId) {
        const messages = await this.findByConversationId(conversationId);
        if (!messages.length) return null;
        
        return messages.reduce((latest, current) => {
            return latest.metadata.timestamp > current.metadata.timestamp ? latest : current;
        });
    }

    /**
     * 获取会话的消息统计
     * @param {string} conversationId 会话ID
     * @returns {Promise<Object>}
     */
    async getConversationStats(conversationId) {
        const messages = await this.findByConversationId(conversationId);
        
        return messages.reduce((stats, message) => {
            stats.totalMessages++;
            stats.totalTokens += message.metadata.tokenCount || 0;
            stats.totalCharacters += message.content.length;
            stats.messagesByType[message.type] = (stats.messagesByType[message.type] || 0) + 1;
            return stats;
        }, {
            totalMessages: 0,
            totalTokens: 0,
            totalCharacters: 0,
            messagesByType: {}
        });
    }

    /**
     * 删除会话的所有消息
     * @param {string} conversationId 会话ID
     * @returns {Promise<void>}
     */
    async deleteConversationMessages(conversationId) {
        const messages = await this.findByConversationId(conversationId);
        await this.bulkDelete(messages.map(message => message.id));
    }

    /**
     * 批量更新消息状态
     * @param {string[]} messageIds 消息ID数组
     * @param {string} status 新状态
     * @returns {Promise<void>}
     */
    async updateMessagesStatus(messageIds, status) {
        const updates = messageIds.map(id => ({
            id,
            entity: { status }
        }));
        await this.bulkUpdate(updates);
    }

    /**
     * 搜索消息内容
     * @param {string} query 搜索关键词
     * @returns {Promise<Message[]>}
     */
    async searchContent(query) {
        return this.findAll(entity => 
            entity.content.toLowerCase().includes(query.toLowerCase())
        );
    }

    /**
     * 获取带有特定标签的消息
     * @param {string[]} tags 标签数组
     * @returns {Promise<Message[]>}
     */
    async findByTags(tags) {
        return this.findAll(entity => 
            tags.some(tag => entity.metadata.tags?.includes(tag))
        );
    }
}
