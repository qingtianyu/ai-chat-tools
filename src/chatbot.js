import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import toolServiceIntegration from './services/tool-service-integration.js';
import { ChatOpenAI } from '@langchain/openai';
import { DatabaseService } from './services/database.js';
import ragService from './services/rag-service-singleton.js';
import userStore from './services/user-store-singleton.js';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import eventManager from './services/event-manager.js';
import CONFIG from './config/index.js';

dotenv.config();

// 初始化服务
const db = new DatabaseService();

// 初始化所有服务
await Promise.all([
    db.initialize(),
    userStore.initialize()
]);

// RAG模式状态
let isRagEnabled = false;
let ragMode = 'single';  // 'single' 或 'multi'

// 监听 RAG 状态变化事件
eventManager.on('rag:stateLoaded', (state) => {
    if (process.env.DEBUG === 'true') {
        console.log('RAG 状态已加载:', state);
    }
    isRagEnabled = state.enabled;
    ragMode = state.mode;
});

eventManager.on('rag:modeChanged', (event) => {
    if (process.env.DEBUG === 'true') {
        console.log(`RAG 模式从 ${event.oldMode} 切换到 ${event.newMode}`);
    }
    ragMode = event.newMode;
});

eventManager.on('rag:enabledChanged', (event) => {
    if (process.env.DEBUG === 'true') {
        console.log(`RAG 状态从 ${event.oldValue} 切换到 ${event.newValue}`);
    }
    isRagEnabled = event.newValue;
});


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
        
        // 等待模式切换和系统知识库加载完成
        const modeChangePromise = ragService.mode = mode;
        if (modeChangePromise instanceof Promise) {
            await modeChangePromise;
        }
        
        // 如果是切换到 multi 模式，等待系统知识库加载完成
        if (mode === 'multi') {
            await new Promise(resolve => {
                const listener = () => {
                    eventManager.off('rag:systemKnowledgeBasesLoaded', listener);
                    resolve();
                };
                eventManager.once('rag:systemKnowledgeBasesLoaded', listener);
                
                // 如果已经加载完成，直接返回
                if (ragService._systemKnowledgeBasesLoaded) {
                    resolve();
                }
            });
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
    
    // 通过 RAG 服务设置启用状态，这会触发事件
    ragService.enabled = newState;
    
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

        // 首先尝试使用 agent 处理所有消息
        try {
            const agentResult = await toolServiceIntegration.executeTask(userMessage);
            
            if (agentResult.success) {
                // 更新会话历史
                conversationHistory.push(
                    { role: 'user', content: userMessage },
                    { role: 'assistant', content: agentResult.output }
                );

                // 保持历史记录在合理范围内
                if (conversationHistory.length > 10) {
                    conversationHistory.splice(0, conversationHistory.length - 10);
                }

                // 保存用户数据
                await saveUser(user);

                return {
                    messages: conversationHistory,
                    metadata: { 
                        mode: 'agent',
                        ...agentResult.metadata
                    },
                    conversationId: conversation.id
                };
            }
        } catch (error) {
            console.error('Agent处理失败:', error);
            // Agent处理失败，继续尝试其他模式
        }

        // 如果 agent 未处理，继续使用 RAG 或普通对话模式
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

                console.log('消息历史:', messages);  // 新添加的调试日志

                // 调用OpenAI API
                const model = new ChatOpenAI({
                    openAIApiKey: CONFIG.OPENAI.API_KEY,
                    modelName: CONFIG.OPENAI.MODEL_NAME,
                    temperature: CONFIG.OPENAI.CHAT_TEMPERATURE,
                    configuration: {
                        apiKey: CONFIG.OPENAI.API_KEY,
                        basePath: CONFIG.OPENAI.API_BASE,
                        baseURL: CONFIG.OPENAI.API_BASE,
                        defaultHeaders: {
                            'Content-Type': 'application/json'
                        }
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
                apiKey: CONFIG.OPENAI.API_KEY,
                modelName: CONFIG.OPENAI.MODEL_NAME,
                configuration: {
                    baseURL: CONFIG.OPENAI.API_BASE,
                    defaultHeaders: {
                        'Content-Type': 'application/json'
                    }
                },
                temperature: CONFIG.OPENAI.CHAT_TEMPERATURE,
                streaming: true
            });

            const messages = [
                new SystemMessage(CONFIG.defaultSystemPrompt),
                ...conversationHistory.map(msg => 
                    msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
                ),
                new HumanMessage(userMessage)
            ];

            console.log('消息历史:', messages);

            const result = await model.invoke(messages);

            conversationHistory.push(
                { role: 'user', content: userMessage },
                { role: 'assistant', content: result.content }
            );

            if (conversationHistory.length > CONFIG.maxConversationLength) {
                conversationHistory.splice(0, conversationHistory.length - CONFIG.maxConversationLength);
            }

            response = {
                messages: conversationHistory,
                metadata: { 
                    mode: 'chat',
                    model: CONFIG.OPENAI.MODEL_NAME
                },
                conversationId: conversation.id
            };
        }

        // 保存更新后的对话历史
        await saveUser(user);

        return response;
    } catch (error) {
        console.error('聊天错误:', error);
        return {
            success: false,
            error: error.message,
            metadata: {
                mode: 'error'
            }
        };
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
