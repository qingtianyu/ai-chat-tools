import { IConversationService } from './IConversationService.js';
import { Conversation, ConversationMetadata } from '../../models/conversation/Conversation.js';
import { Message, MessageMetadata } from '../../models/conversation/Message.js';
import { IdGenerator } from '../../../utils/idGenerator.js';

/**
 * 会话服务实现
 */
export class ConversationService extends IConversationService {
    constructor(conversationRepository, userService, eventEmitter) {
        super();
        this.conversationRepository = conversationRepository;
        this.userService = userService;
        this.eventEmitter = eventEmitter;
    }

    async createConversation(userId) {
        const user = await this.userService.getUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const conversationId = IdGenerator.generateId();
        const conversation = new Conversation({
            id: conversationId,
            userId,
            metadata: new ConversationMetadata()
        });

        await this.conversationRepository.create(conversation);
        this.eventEmitter.emit('conversation:created', conversation);

        return conversation;
    }

    async addMessage(conversationId, messageData) {
        const conversation = await this.getConversationById(conversationId);
        if (!conversation) {
            throw new Error('Conversation not found');
        }

        const message = new Message({
            id: IdGenerator.generateId(),
            role: messageData.role,
            content: messageData.content,
            metadata: new MessageMetadata(messageData.metadata)
        });

        conversation.addMessage(message);
        await this.conversationRepository.update(conversationId, conversation);
        this.eventEmitter.emit('conversation:message:added', { conversationId, message });

        return message;
    }

    async getConversationHistory(conversationId) {
        const conversation = await this.getConversationById(conversationId);
        if (!conversation) {
            throw new Error('Conversation not found');
        }
        return conversation.messages;
    }

    async deleteConversation(conversationId) {
        const conversation = await this.getConversationById(conversationId);
        if (!conversation) {
            throw new Error('Conversation not found');
        }

        await this.conversationRepository.delete(conversationId);
        this.eventEmitter.emit('conversation:deleted', conversationId);
    }

    async archiveConversation(conversationId) {
        const conversation = await this.getConversationById(conversationId);
        if (!conversation) {
            throw new Error('Conversation not found');
        }

        conversation.archive();
        await this.conversationRepository.update(conversationId, conversation);
        this.eventEmitter.emit('conversation:archived', conversationId);
    }

    async restoreConversation(conversationId) {
        const conversation = await this.getConversationById(conversationId);
        if (!conversation) {
            throw new Error('Conversation not found');
        }

        conversation.restore();
        await this.conversationRepository.update(conversationId, conversation);
        this.eventEmitter.emit('conversation:restored', conversationId);
    }

    async getUserConversations(userId, filters = {}) {
        const user = await this.userService.getUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        return this.conversationRepository.findByUserId(userId, filters);
    }

    async getConversationById(conversationId) {
        const conversation = await this.conversationRepository.findById(conversationId);
        if (!conversation) {
            return null;
        }
        return new Conversation(conversation);
    }
}
