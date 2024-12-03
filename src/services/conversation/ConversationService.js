import { v4 as uuidv4 } from 'uuid';
import CONFIG from '../../config/index.js';
import { ChatError, ErrorCodes } from '../../utils/ErrorHandler.js';
import UserService from '../user/UserService.js';

class ConversationService {
    static #instance = null;
    #userService;

    constructor() {
        if (ConversationService.#instance) {
            return ConversationService.#instance;
        }
        this.#userService = UserService.getInstance();
        ConversationService.#instance = this;
    }

    static getInstance() {
        if (!ConversationService.#instance) {
            ConversationService.#instance = new ConversationService();
        }
        return ConversationService.#instance;
    }

    async getConversation(userId, conversationId) {
        const user = await this.#userService.getUser(userId);
        if (!user) {
            throw new ChatError(
                '用户不存在',
                ErrorCodes.USER_NOT_FOUND,
                { userId }
            );
        }

        const conversation = user.conversations.find(c => c.id === conversationId);
        if (!conversation) {
            throw new ChatError(
                '会话不存在',
                ErrorCodes.CONVERSATION_NOT_FOUND,
                { userId, conversationId }
            );
        }

        return conversation;
    }

    async createConversation(userId) {
        const user = await this.#userService.getOrCreateUser(userId);
        
        const conversation = {
            id: uuidv4(),
            messages: [],
            created: new Date().toISOString(),
            lastActive: new Date().toISOString()
        };

        user.conversations.push(conversation);
        await this.#userService.saveUser(user);

        return conversation;
    }

    async addMessage(userId, conversationId, message) {
        const user = await this.#userService.getUser(userId);
        if (!user) {
            throw new ChatError(
                '用户不存在',
                ErrorCodes.USER_NOT_FOUND,
                { userId }
            );
        }

        const conversation = user.conversations.find(c => c.id === conversationId);
        if (!conversation) {
            throw new ChatError(
                '会话不存在',
                ErrorCodes.CONVERSATION_NOT_FOUND,
                { userId, conversationId }
            );
        }

        conversation.messages.push(message);
        conversation.lastActive = new Date().toISOString();

        // 保持历史记录在限制范围内
        if (conversation.messages.length > CONFIG.conversation.maxConversationLength) {
            conversation.messages.splice(
                0,
                conversation.messages.length - CONFIG.conversation.maxConversationLength
            );
        }

        await this.#userService.saveUser(user);
        return conversation;
    }

    async getOrCreateConversation(userId, conversationId) {
        try {
            if (conversationId) {
                return await this.getConversation(userId, conversationId);
            }
            return await this.createConversation(userId);
        } catch (error) {
            if (error.code === ErrorCodes.CONVERSATION_NOT_FOUND) {
                return await this.createConversation(userId);
            }
            throw error;
        }
    }
}

export default ConversationService;
