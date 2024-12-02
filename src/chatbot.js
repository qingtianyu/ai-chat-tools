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
let ragMode = 'single';  // 'single' 或 'multi'

// 检查 RAG 服务状态
async function checkRagStatus() {
    try {
        console.log('\n=== RAG Service Status ===');
        const status = await ragService.getStatus();
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
export async function toggleRag(enable = null, mode = null) {
    console.log('Toggling RAG mode:', enable, 'Mode:', mode);
    const status = await checkRagStatus();
    
    // 处理开关状态
    const newState = enable === null ? !isRagEnabled : enable;
    
    // 处理模式切换
    if (mode) {
        if (mode !== 'single' && mode !== 'multi') {
            return {
                success: false,
                message: '无效的查询模式，只支持 single 或 multi'
            };
        }
        ragMode = mode;
        
        // 如果切换到多知识库模式，确保加载所有知识库
        if (mode === 'multi' && newState) {
            const loadResult = await ragService.loadAllKnowledgeBases();
            if (!loadResult.success) {
                return {
                    success: false,
                    message: `无法加载知识库: ${loadResult.message}`
                };
            }
            console.log(loadResult.message);
        }
    }
    
    if (newState) {
        // 确保RAG服务已初始化
        if (!status.currentKnowledgeBase && ragMode === 'single') {
            return {
                success: false,
                message: '请先使用 kb switch 选择一个知识库'
            };
        }
    }
    
    isRagEnabled = newState;
    return {
        success: true,
        enabled: isRagEnabled,
        mode: ragMode,
        message: `RAG ${isRagEnabled ? '已开启' : '已关闭'}${isRagEnabled ? ` (${ragMode} 模式)` : ''}`
    };
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
        if (process.env.DEBUG) {
            console.log('\n=== Debug: Chat Processing ===');
            console.log('RAG Enabled:', isRagEnabled);
        }
        
        if (isRagEnabled) {
            try {
                if (process.env.DEBUG) {
                    console.log('Attempting RAG processing...');
                    console.log('Current RAG mode:', ragMode);
                }
                
                // 使用RAG处理消息
                const ragResult = await ragService.processMessage(userMessage, { mode: ragMode });
                if (process.env.DEBUG) {
                    console.log('RAG Result received:', !!ragResult);
                }
                
                // 添加调试日志
                if (process.env.DEBUG) {
                    console.log('\n=== RAG 检索结果 ===');
                    // 显示查询的知识库
                    if (ragMode === 'multi' && ragResult.metadata?.knowledgeBases) {
                        console.log('查询的知识库:', ragResult.metadata.knowledgeBases.join(', '));
                    } else {
                        const status = await ragService.getStatus();
                        console.log('查询的知识库:', status.currentKnowledgeBase);
                    }
                    
                    // 显示相关度分数
                    if (ragResult.metadata?.scores) {
                        console.log('相关度分数:', ragResult.metadata.scores.join(', '));
                    }
                    
                    // 显示检索到的内容
                    if (ragResult.context) {
                        console.log('\n检索到的内容:');
                        console.log(ragResult.context);
                    }
                }

                // 组合提示
                const prompt = ragResult.context ? 
                    `基于以下内容回答问题:\n\n${ragResult.context}\n\n问题: ${userMessage}` :
                    userMessage;

                // 构建系统消息
                const systemMessage = new SystemMessage(prompt);

                // 构建消息历史
                const messages = [
                    systemMessage,
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
                        knowledgeBase: ragMode === 'multi' ? ragResult.metadata.knowledgeBases.join(', ') : (await ragService.getStatus()).currentKnowledgeBase,
                        matchCount: ragResult.metadata?.matchCount,
                        references: ragResult.documents?.map((doc, index) => ({
                            id: index + 1,
                            score: doc.score,
                            excerpt: doc.content
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
