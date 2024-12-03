import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createToolCallingAgent } from "langchain/agents";
import { AgentExecutor } from "langchain/agents";
import { ChatMessageHistory } from "@langchain/community/stores/message/in_memory";
import { calculatorTool, timeTool, windowsCommandTool, fileOperationTool, WebBrowserTool, SearchTool, WebScraperTool } from "../tools/index.js";
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

        // 初始化 web 工具
        const webBrowser = new WebBrowserTool({ model: this.model });
        const searchTool = new SearchTool();
        const webScraper = new WebScraperTool();

        // 定义工具列表
        this.tools = [
            calculatorTool, 
            timeTool, 
            windowsCommandTool, 
            fileOperationTool,
            webBrowser,
            searchTool,
            webScraper
        ];

        // 定义提示模板
        this.prompt = ChatPromptTemplate.fromMessages([
            ["system", `你是一个智能助手，可以帮助用户完成各种任务。你会根据用户的需求，选择合适的工具来完成任务：

- 时间查询：使用 time 工具
  * 查询时间：使用 type: 'time'
  * 查询日期：使用 type: 'date'
  * 查询完整时间：使用 type: 'full'
- 数学计算：使用 calculator 工具
- 文件处理：使用 fileOperation 工具
- 系统命令：使用 windowsCommand 工具
- 网页浏览：使用 web_browser 工具（可提取内容、代码和生成摘要）
- 搜索引擎：使用 web_search 工具（支持必应搜索）
- 网页抓取：使用 web_scraper 工具（简单的网页内容获取）

注意：对于时间查询，请根据用户的具体需求选择合适的类型：
- "几点了"、"现在几点" → type: 'time'
- "今天日期"、"几号了" → type: 'date'
- "现在是什么时候" → type: 'full'`],
            ["human", "{input}"],
            ["assistant", "{agent_scratchpad}"]
        ]);

        // 初始化消息历史存储
        this.messageStore = {};

        // 初始化标志
        this.initialized = false;
        this.initPromise = this.initializeAgent();
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

            this.initialized = true;
            console.log('Agent 初始化成功');

        } catch (error) {
            console.error('初始化Agent失败:', error);
            throw error;
        }
    }

    async executeTask(input, sessionId = 'default') {
        try {
            // 确保 Agent 已初始化
            if (!this.initialized) {
                await this.initPromise;
            }

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