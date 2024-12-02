import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createToolCallingAgent } from "langchain/agents";
import { AgentExecutor } from "langchain/agents";
import { ChatMessageHistory } from "@langchain/community/stores/message/in_memory";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { calculatorTool, timeTool, windowsCommandTool, fileOperationTool } from "../tools/systemTools.js";
import dotenv from 'dotenv';

dotenv.config();

export class AgentToolService {
    constructor() {
        // 初始化 OpenAI 模型
        this.model = new ChatOpenAI({
            openAIApiKey: 'sk-aRUVCBaoLTtfKSfX573c06D3779a41D4B26b00F11dF9Eb37',
            modelName: 'gpt-4',
            configuration: {
                apiKey: 'sk-aRUVCBaoLTtfKSfX573c06D3779a41D4B26b00F11dF9Eb37',
                basePath: 'https://closeproxy.unidtai.com/v1',
                baseURL: 'https://closeproxy.unidtai.com/v1'
            }
        });

        // 定义工具列表
        this.tools = [calculatorTool, timeTool, windowsCommandTool, fileOperationTool];

        // 定义提示模板
        this.prompt = ChatPromptTemplate.fromMessages([
            ["system", "你是一个智能助手，可以帮助用户完成各种任务。你会根据用户的需求，选择合适的工具来完成任务。"],
            ["human", "{input}"],
            ["assistant", "{agent_scratchpad}"]
        ]);

        // 初始化消息历史存储
        this.messageStore = {};

        // 初始化 Agent
        this.initializeAgent();
    }

    async initializeAgent() {
        try {
            // 创建工具调用代理
            const agent = await createToolCallingAgent({
                llm: this.model,
                tools: this.tools,
                prompt: this.prompt
            });

            // 创建代理执行器
            this.executor = AgentExecutor.fromAgentAndTools({
                agent,
                tools: this.tools,
                verbose: false
            });

        } catch (error) {
            console.error('初始化Agent失败:', error);
            throw error;
        }
    }

    async executeTask(input, sessionId = 'default') {
        try {
            if (!sessionId) {
                sessionId = 'default';
            }

            // 获取历史记录
            const history = this.getMessageHistory(sessionId);
            
            // 执行任务
            const result = await this.executor.invoke({
                input,
                chat_history: await history.getMessages()
            });

            // 更新历史记录
            await history.addUserMessage(input);
            await history.addAIMessage(result.output);

            return {
                success: true,
                output: result.output,
                metadata: {
                    mode: 'agent',
                    toolCalls: result.intermediateSteps
                }
            };

        } catch (error) {
            console.error("任务执行失败:", error);
            return {
                success: false,
                error: error.message,
                metadata: {
                    mode: 'agent',
                    error: error
                }
            };
        }
    }

    getMessageHistory(sessionId) {
        if (!(sessionId in this.messageStore)) {
            this.messageStore[sessionId] = new ChatMessageHistory();
        }
        return this.messageStore[sessionId];
    }

    clearHistory(sessionId) {
        if (sessionId in this.messageStore) {
            delete this.messageStore[sessionId];
        }
    }

    // 获取已注册的工具列表
    getTools() {
        return this.tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            schema: tool.schema,
        }));
    }
}

export default new AgentToolService();