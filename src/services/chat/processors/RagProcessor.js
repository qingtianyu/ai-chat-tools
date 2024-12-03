import BaseProcessor from './BaseProcessor.js';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { ErrorHandler, ErrorCodes } from '../../../utils/ErrorHandler.js';

export class RagProcessor extends BaseProcessor {
    constructor(openAIClient, config) {
        super();
        this.openAIClient = openAIClient;
        this.config = config;
        this.ragService = null;
    }

    async init(ragService) {
        this.ragService = ragService;
    }

    async process(input, context = {}) {
        try {
            if (!this.ragService) {
                throw new Error('RAG 服务未初始化');
            }

            // 执行相似度搜索
            const searchResults = await this.ragService.processMessage(input);

            // 如果没有找到相关文档
            if (!searchResults || searchResults.length === 0) {
                return {
                    content: '抱歉，我没有找到相关的参考信息来回答你的问题。',
                    metadata: {
                        searchResults: []
                    }
                };
            }

            // 构建系统提示
            const systemPrompt = `你是一个专业的 AI 助手。请根据以下参考信息来回答用户的问题。
参考信息：
${searchResults.map((doc, i) => `[${i + 1}] ${doc.pageContent}`).join('\n\n')}

请注意：
1. 使用参考信息来构建答案
2. 如果参考信息不足以完整回答问题，请说明
3. 保持专业、准确、简洁的回答风格`;

            // 构建消息历史
            const messages = [
                new SystemMessage(systemPrompt),
                new HumanMessage(input)
            ];

            // 如果有对话历史，添加到消息中
            if (context.conversation?.messages) {
                const historyMessages = context.conversation.messages.map(msg => 
                    msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
                );
                messages.splice(1, 0, ...historyMessages);
            }

            // 获取 AI 回复
            const response = await this.openAIClient.chatCompletion(messages);

            return {
                content: response,
                metadata: {
                    searchResults: searchResults
                }
            };

        } catch (error) {
            console.error('RAG 处理失败:', error);
            throw new ErrorHandler(
                ErrorCodes.RAG_PROCESSING_ERROR,
                '处理消息时出错',
                error
            );
        }
    }
}

export default RagProcessor;
