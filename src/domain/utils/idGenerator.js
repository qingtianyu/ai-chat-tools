import { randomUUID } from 'crypto';

/**
 * ID生成器工具类
 */
export class IdGenerator {
    /**
     * 生成UUID
     * @returns {string} UUID字符串
     */
    static generateUUID() {
        return randomUUID();
    }

    /**
     * 生成时间戳ID
     * @returns {string} 时间戳ID
     */
    static generateTimestampId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 生成指定长度的随机ID
     * @param {number} length ID长度
     * @returns {string} 随机ID
     */
    static generateRandomId(length = 16) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * 生成带前缀的ID
     * @param {string} prefix ID前缀
     * @returns {string} 带前缀的ID
     */
    static generatePrefixedId(prefix) {
        return `${prefix}-${this.generateUUID()}`;
    }

    /**
     * 生成用户ID
     * @returns {string} 用户ID
     */
    static generateUserId() {
        return this.generatePrefixedId('usr');
    }

    /**
     * 生成会话ID
     * @returns {string} 会话ID
     */
    static generateConversationId() {
        return this.generatePrefixedId('conv');
    }

    /**
     * 生成消息ID
     * @returns {string} 消息ID
     */
    static generateMessageId() {
        return this.generatePrefixedId('msg');
    }

    /**
     * 生成知识库ID
     * @returns {string} 知识库ID
     */
    static generateKnowledgeBaseId() {
        return this.generatePrefixedId('kb');
    }

    /**
     * 生成文档块ID
     * @returns {string} 文档块ID
     */
    static generateChunkId() {
        return this.generatePrefixedId('chunk');
    }
}
