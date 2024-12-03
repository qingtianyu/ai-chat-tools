/**
 * 会话服务接口
 */
export class IConversationService {
    /**
     * 创建新会话
     * @param {string} userId 用户ID
     * @param {Object} initialMessage 初始消息
     * @returns {Promise<Conversation>}
     */
    async createConversation(userId, initialMessage) {
        throw new Error('Not implemented');
    }

    /**
     * 获取会话
     * @param {string} conversationId 会话ID
     * @returns {Promise<Conversation>}
     */
    async getConversation(conversationId) {
        throw new Error('Not implemented');
    }

    /**
     * 添加消息到会话
     * @param {string} conversationId 会话ID
     * @param {string} content 消息内容
     * @param {string} type 消息类型
     * @returns {Promise<Message>}
     */
    async addMessage(conversationId, content, type) {
        throw new Error('Not implemented');
    }

    /**
     * 获取会话消息
     * @param {string} conversationId 会话ID
     * @returns {Promise<Message[]>}
     */
    async getMessages(conversationId) {
        throw new Error('Not implemented');
    }

    /**
     * 归档会话
     * @param {string} conversationId 会话ID
     * @returns {Promise<void>}
     */
    async archiveConversation(conversationId) {
        throw new Error('Not implemented');
    }

    /**
     * 删除会话
     * @param {string} conversationId 会话ID
     * @returns {Promise<void>}
     */
    async deleteConversation(conversationId) {
        throw new Error('Not implemented');
    }

    /**
     * 获取用户的所有会话
     * @param {string} userId 用户ID
     * @returns {Promise<Conversation[]>}
     */
    async getUserConversations(userId) {
        throw new Error('Not implemented');
    }
}
