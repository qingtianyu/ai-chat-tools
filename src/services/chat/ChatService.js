import MessageProcessor from './MessageProcessor.js';
import ConversationService from '../conversation/ConversationService.js';
import UserService from '../user/UserService.js';
import { RAGService } from '../rag-service.js';
import RateLimiter from '../../utils/RateLimiter.js';

class ChatService {
    static #instance = null;
    #messageProcessor;
    #conversationService;
    #userService;
    #ragService;
    rateLimiter;

    constructor() {
        if (ChatService.#instance) {
            return ChatService.#instance;
        }
        
        this.#messageProcessor = MessageProcessor.getInstance();
        this.#conversationService = ConversationService.getInstance();
        this.#userService = UserService.getInstance();
        this.#ragService = RAGService.getInstance();
        this.rateLimiter = new RateLimiter();
        ChatService.#instance = this;
    }

    static getInstance() {
        if (!ChatService.#instance) {
            ChatService.#instance = new ChatService();
        }
        return ChatService.#instance;
    }

    async chat(userMessage, userId, conversationId) {
        return await this.rateLimiter.executeWithRetry(async () => {
            try {
                // 获取用户信息
                const user = await this.#userService.getUser(userId);
                if (!user) {
                    throw new Error('User not found');
                }

                // 获取或创建会话
                const conversation = await this.#conversationService.getOrCreateConversation(
                    userId,
                    conversationId
                );

                // 准备上下文
                const context = {
                    conversation,
                    user,
                    rag: {
                        enabled: await this.#ragService.isEnabled(conversationId),
                        mode: await this.#ragService.getMode(conversationId),
                        currentKnowledgeBase: await this.#ragService.getCurrentKnowledgeBase()
                    }
                };

                // 处理消息
                const result = await this.#messageProcessor.process(userMessage, context);

                // 保存会话更新
                await this.#conversationService.addMessage(
                    userId,
                    conversation.id,
                    { role: 'user', content: userMessage }
                );

                if (result.success) {
                    const assistantMessage = result.messages[result.messages.length - 1];
                    await this.#conversationService.addMessage(
                        userId,
                        conversation.id,
                        { 
                            role: 'assistant', 
                            content: assistantMessage.content,
                            metadata: result.metadata
                        }
                    );
                }

                return {
                    success: result.success,
                    messages: result.messages,
                    metadata: result.metadata,
                    conversationId: conversation.id,
                    error: result.error
                };
            } catch (error) {
                if (error.message.includes('rate limit')) {
                    throw new Error('API rate limit reached. Please try again in a moment.');
                }
                console.error('Error in ChatService.chat:', error);
                return {
                    success: false,
                    messages: [],
                    error: error.message || 'Unknown error occurred'
                };
            }
        });
    }

    // 获取用户会话列表
    async getConversations(userId) {
        try {
            return await this.#conversationService.getUserConversations(userId);
        } catch (error) {
            console.error('Error getting conversations:', error);
            throw error;
        }
    }

    // 切换RAG模式
    async toggleRag(enabled, mode = null) {
        try {
            await this.#ragService.setEnabled(enabled);
            if (mode) {
                await this.#ragService.setMode(mode);
            }
            return {
                success: true,
                enabled,
                mode: await this.#ragService.getMode()
            };
        } catch (error) {
            console.error('Error toggling RAG:', error);
            throw error;
        }
    }

    // 获取RAG状态
    async getRagStatus() {
        try {
            return {
                enabled: await this.#ragService.isEnabled(),
                mode: await this.#ragService.getMode(),
                currentKnowledgeBase: await this.#ragService.getCurrentKnowledgeBase()
            };
        } catch (error) {
            console.error('Error getting RAG status:', error);
            throw error;
        }
    }
}

export default ChatService;
