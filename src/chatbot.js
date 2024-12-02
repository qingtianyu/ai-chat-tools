import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { DatabaseService } from './services/database.js';
import ragService from './services/rag-service-singleton.js';
import userStore from './services/user-store-singleton.js';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

// 初始化服务
const db = new DatabaseService();

// 初始化所有服务
await Promise.all([
    db.initialize(),
    userStore.initialize()
]);

// 配置
const CONFIG = {
    summaryThreshold: 30,
    relevantMemories: 5,
    maxConversationLength: 100,
    defaultSystemPrompt: `你是一个专业、友好且功能强大的AI助手。你具有以下特点和要求：

1. 知识渊博：你能够回答各种领域的问题
2. 对话风格：
   - 专业且简洁
   - 使用markdown格式输出
   - 适当使用emoji增加趣味性
3. 特殊能力：
   - 必须记住并使用用户提供的信息（如姓名、年龄等）
   - 可以进行简单计算
   - 擅长解释复杂概念
   - 能够利用历史对话中的相关信息

4. 记忆要求：
   - 记住用户的个人信息和偏好
   - 在对话中自然地引用这些信息
   - 对矛盾的信息提出疑问
   - 主动询问缺失的重要信息`
};

// RAG模式状态
let isRagEnabled = false;

// 检查 RAG 服务状态
async function checkRagStatus() {
    try {
        const status = await ragService.getStatus();
        console.log('\n=== RAG Service Status ===');
        console.log('Initialized:', status.isInitialized);
        console.log('Current KB:', status.currentKnowledgeBase);
        console.log('Document Count:', status.documentCount);
        return status;
    } catch (error) {
        console.error('Error checking RAG status:', error);
        return null;
    }
}

/**
 * 切换RAG模式
 * @returns {Promise<Object>} 返回切换结果，包含状态和消息
 */
export async function toggleRag() {
    try {
        // 尝试切换状态
        const newState = !isRagEnabled;
        
        if (newState) {
            // 确保RAG服务已初始化
            const status = await checkRagStatus();
            if (!status.currentKnowledgeBase || !status.isInitialized) {
                return {
                    success: false,
                    enabled: false,
                    message: '请先使用 kb switch 命令选择一个知识库'
                };
            }
            isRagEnabled = true;
            return {
                success: true,
                enabled: true,
                message: `🧠 RAG模式已启用，使用知识库 "${status.currentKnowledgeBase}" 增强对话`,
                knowledgeBase: status.currentKnowledgeBase
            };
        } else {
            isRagEnabled = false;
            return {
                success: true,
                enabled: false,
                message: '💬 已切换到普通对话模式'
            };
        }
    } catch (error) {
        // 确保在发生错误时重置状态
        isRagEnabled = false;
        return {
            success: false,
            enabled: false,
            message: `❌ RAG模式切换失败: ${error.message}`
        };
    }
}

export async function chat(userMessage, userId, conversationId) {
    try {
        // 获取或创建用户的对话历史
        let user = await getUser(userId);
        if (!user) {
            user = await createUser(userId);
        }

        let conversation;
        if (conversationId) {
            conversation = user.conversations.find(c => c.id === conversationId);
            if (!conversation) {
                throw new Error(`会话 ${conversationId} 未找到`);
            }
        } else {
            conversation = {
                id: uuidv4(),
                messages: []
            };
            user.conversations.push(conversation);
            await saveUser(user);
        }

        const conversationHistory = conversation.messages;

        let response;
        console.log('\n=== Debug: Chat Processing ===');
        console.log('RAG Enabled:', isRagEnabled);
        
        if (isRagEnabled) {
            try {
                console.log('Attempting RAG processing...');
                // 使用RAG处理消息
                const ragResult = await ragService.processMessage(userMessage);
                console.log('RAG Result received:', !!ragResult);
                
                // 添加调试日志
                console.log('\n=== RAG 检索结果 ===');
                console.log('知识库:', ragResult.metadata?.knowledgeBase);
                console.log('匹配文档数:', ragResult.metadata?.matchCount);
                console.log('Documents:', ragResult.documents ? ragResult.documents.length : 0);
                
                if (ragResult.documents?.length > 0) {
                    console.log('相关度分数:', ragResult.documents.map(doc => `${(doc.score * 100).toFixed(1)}%`).join(', '));
                    console.log('\n检索到的内容片段:');
                    ragResult.documents.forEach((doc, index) => {
                        console.log(`\n片段 ${index + 1} (相关度: ${(doc.score * 100).toFixed(1)}%):`);
                        console.log(doc.pageContent);
                    });
                } else {
                    console.log('Warning: No documents found in RAG result');
                }
                
                // 构建系统消息
                const systemMessage = `你是一个专业的AI助手。请基于以下知识库内容回答用户的问题：\n\n${ragResult.context}`;

                // 构建消息历史
                const messages = [
                    new SystemMessage(systemMessage),
                    ...conversationHistory.map(msg => 
                        msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
                    ),
                    new HumanMessage(userMessage)
                ];

                // 调用OpenAI API
                const model = new ChatOpenAI({
                    openAIApiKey: process.env.OPENAI_API_KEY,
                    modelName: process.env.MODEL_NAME || 'gpt-3.5-turbo',
                    configuration: {
                        apiKey: process.env.OPENAI_API_KEY,
                        basePath: process.env.OPENAI_BASE_URL,
                        baseURL: process.env.OPENAI_BASE_URL
                    }
                });

                const result = await model.invoke(messages);

                // 获取AI回复
                const aiMessage = result.content;

                // 更新消息历史
                conversationHistory.push(
                    { role: 'user', content: userMessage },
                    { role: 'assistant', content: aiMessage }
                );

                // 保持历史记录在合理范围内
                if (conversationHistory.length > 10) {
                    conversationHistory.splice(0, conversationHistory.length - 10);
                }

                // 返回结果
                response = {
                    messages: conversationHistory,
                    metadata: {
                        mode: 'rag',
                        knowledgeBase: ragResult.metadata.knowledgeBase,
                        matchCount: ragResult.documents.length,
                        references: ragResult.documents.map((doc, index) => ({
                            id: index + 1,
                            score: doc.score,
                            excerpt: doc.pageContent
                        })),
                        context: ragResult.context
                    },
                    conversationId: conversation.id
                };
            } catch (error) {
                console.error('RAG处理失败，切换到普通对话模式:', error.message);
                isRagEnabled = false;
                throw error;
            }
        }

        if (!response) {
            // 使用普通对话模式
            const model = new ChatOpenAI({
                openAIApiKey: process.env.OPENAI_API_KEY,
                modelName: process.env.MODEL_NAME || 'gpt-3.5-turbo',
                configuration: {
                    apiKey: process.env.OPENAI_API_KEY,
                    basePath: process.env.OPENAI_BASE_URL,
                    baseURL: process.env.OPENAI_BASE_URL
                }
            });

            const messages = [
                new SystemMessage('你是一个友好的AI助手。'),
                ...conversationHistory.map(msg => 
                    msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
                ),
                new HumanMessage(userMessage)
            ];

            const result = await model.invoke(messages);

            conversationHistory.push(
                { role: 'user', content: userMessage },
                { role: 'assistant', content: result.content }
            );

            if (conversationHistory.length > 10) {
                conversationHistory.splice(0, conversationHistory.length - 10);
            }

            response = {
                messages: conversationHistory,
                metadata: { mode: 'normal' },
                conversationId: conversation.id
            };
        }

        // 保存更新后的对话历史
        await saveUser(user);

        return response;
    } catch (error) {
        console.error('聊天错误:', error);
        throw error;
    }
}

async function getUser(userId) {
    try {
        const userData = await userStore.getUserData(userId);
        if (!userData) {
            return null;
        }
        return userData;
    } catch (error) {
        console.error('获取用户数据失败:', error);
        throw error;
    }
}

async function createUser(userId) {
    try {
        const newUser = {
            id: userId,
            conversations: []
        };
        await userStore.saveUserData(userId, newUser);
        return newUser;
    } catch (error) {
        console.error('创建用户失败:', error);
        throw error;
    }
}

async function saveUser(user) {
    try {
        await userStore.saveUserData(user.id, user);
    } catch (error) {
        console.error('保存用户数据失败:', error);
        throw error;
    }
}
