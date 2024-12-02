/**
 * LangGraph 流式输出智能助手测试
 * 
 * 功能说明：
 * 1. 支持流式输出 - 实时显示AI响应
 * 2. 支持多种工具调用 - 计算器、时间查询和系统命令
 * 3. 包含完整的日志系统 - 使用彩色日志跟踪执行流程
 */

import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { StateGraph, MemorySaver } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";
import { DataSource } from "typeorm";
import { createInterface } from "readline";
import { stdin as input, stdout as output } from "process";
import { getAllTools } from './tools/index.js';
import chalk from 'chalk';
import { CONFIG } from './config.js';
import { SQLExecutionTool } from './tools/sqlTools.js';
import * as fs from 'fs/promises';

// 创建数据库连接
const datasource = new DataSource({
    type: CONFIG.DATABASE.TYPE,
    database: CONFIG.DATABASE.PATH
});

// 初始化数据库连接
await datasource.initialize();
console.log("数据库连接已建立");

// 创建模型和嵌入实例
const model = new ChatOpenAI({
    apiKey: CONFIG.OPENAI.API_KEY,
    modelName: CONFIG.OPENAI.MODEL_NAME,
    configuration: {
        baseURL: CONFIG.OPENAI.API_BASE,
        defaultHeaders: {
            'Content-Type': 'application/json'
        }
    },
    temperature: CONFIG.OPENAI.TOOLS_TEMPERATURE,
    streaming: true
});

const embeddings = new OpenAIEmbeddings({
    apiKey: CONFIG.OPENAI.API_KEY,
    configuration: {
        baseURL: CONFIG.OPENAI.API_BASE
    }
});

// 创建工具实例
const tools = getAllTools({ 
    datasource, 
    model, // 直接传入模型
    embeddings 
});

// 绑定工具到模型
const modelWithTools = model.bind({
    tools: tools
});

// 日志颜色配置
const LOG_COLORS = {
    step: CONFIG.COLORS.CYAN,
    success: CONFIG.COLORS.GREEN,
    error: CONFIG.COLORS.RED,
    info: CONFIG.COLORS.BLUE,
    reset: CONFIG.COLORS.RESET
};

// 日志工具
const logger = {
    debug: (...args) => CONFIG.LOGGING.LEVEL === 'debug' && console.log(chalk.gray('[调试]'), ...args),
    info: (...args) => ['debug', 'info'].includes(CONFIG.LOGGING.LEVEL) && console.log(chalk.blue('[信息]'), ...args),
    warn: (...args) => ['debug', 'info', 'warn'].includes(CONFIG.LOGGING.LEVEL) && console.log(chalk.yellow('[警告]'), ...args),
    error: (...args) => console.log(chalk.red('[错误]'), ...args),
    success: (...args) => console.log(chalk.green('[成功]'), ...args),
    step: (...args) => CONFIG.LOGGING.SHOW_TOOL_LOGS && console.log(chalk.cyan('[步骤]'), ...args),
    toolCall: (...args) => false && console.log(chalk.blue('[工具调用]'), ...args)
};

// 定义状态注解
const StateAnnotation = Annotation.Root({
    messages: Annotation({
        reducer: (x, y) => x.concat(y),
    }),
    turns: Annotation({
        value: 0,
        default: () => 0,
        reducer: (_, next) => next
    })
});

// 调用模型的节点函数
const callModel = async (state) => {
    logger.toolCall("开始调用模型...");
    const { messages } = state;
    
    const responseMessage = await modelWithTools.invoke(messages);
    return { 
        messages: [responseMessage],
        turns: (state.turns || 0) + 1
    };
};

// 调用工具的节点函数
const callTools = async (state) => {
    const { messages } = state;
    const lastMessage = messages[messages.length - 1];
    
    // 添加调试日志
    logger.toolCall(`最后一条消息: ${JSON.stringify(lastMessage, null, 2)}`);
    
    // 检查是否是直接的SQL语句
    if (typeof lastMessage.content === 'string') {
        const content = lastMessage.content.trim().toUpperCase();
        if (content.startsWith('INSERT')) {
            logger.toolCall('检测到INSERT语句，使用insertTool');
            const tool = tools.find(t => t.name === 'insert-sql');
            if (tool) {
                try {
                    const result = await tool._call({ query: lastMessage.content });
                    return {
                        messages: [{
                            tool_call_id: 'direct-sql',
                            role: 'tool',
                            name: 'insert-sql',
                            content: result
                        }],
                        turns: state.turns
                    };
                } catch (error) {
                    logger.error(`INSERT执行失败: ${error.message}`);
                }
            }
        } else if (content.startsWith('UPDATE')) {
            logger.toolCall('检测到UPDATE语句，使用updateTool');
            const tool = tools.find(t => t.name === 'update-sql');
            if (tool) {
                try {
                    const result = await tool._call({ query: lastMessage.content });
                    return {
                        messages: [{
                            tool_call_id: 'direct-sql',
                            role: 'tool',
                            name: 'update-sql',
                            content: result
                        }],
                        turns: state.turns
                    };
                } catch (error) {
                    logger.error(`UPDATE执行失败: ${error.message}`);
                }
            }
        } else if (content.startsWith('DELETE')) {
            logger.toolCall('检测到DELETE语句，使用deleteTool');
            const tool = tools.find(t => t.name === 'delete-sql');
            if (tool) {
                try {
                    const result = await tool._call({ query: lastMessage.content });
                    return {
                        messages: [{
                            tool_call_id: 'direct-sql',
                            role: 'tool',
                            name: 'delete-sql',
                            content: result
                        }],
                        turns: state.turns
                    };
                } catch (error) {
                    logger.error(`DELETE执行失败: ${error.message}`);
                }
            }
        }
    }
    
    if (!lastMessage?.additional_kwargs?.tool_calls?.length) {
        throw new Error("没有工具调用。");
    }

    logger.toolCall("开始执行工具调用...");
    const toolCalls = lastMessage.additional_kwargs.tool_calls;
    logger.toolCall(`工具调用: ${JSON.stringify(toolCalls, null, 2)}`);
    
    const toolResults = await Promise.all(
        toolCalls.map(async (toolCall) => {
            const tool = tools.find(t => t.name === toolCall.function.name);
            if (!tool) {
                logger.error(`未找到工具: ${toolCall.function.name}`);
                return null;
            }
            
            try {
                const args = JSON.parse(toolCall.function.arguments);
                logger.toolCall(`执行工具 ${toolCall.function.name} 参数: ${JSON.stringify(args, null, 2)}`);
                const result = await tool._call(args);
                logger.success(`工具 ${toolCall.function.name} 执行成功`);
                return {
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: toolCall.function.name,
                    content: result,
                };
            } catch (error) {
                logger.error(`工具执行失败: ${error.message}`);
                return {
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: toolCall.function.name,
                    content: `工具执行错误: ${error.message}`,
                };
            }
        })
    );

    return { 
        messages: toolResults.filter(r => r !== null),
        turns: state.turns
    };
};

// 工具调用函数
async function executeToolCalls(toolCalls) {
    const results = [];
    
    for (const toolCall of toolCalls) {
        const { name, arguments: args } = toolCall.function;
        
        try {
            let result;
            switch (name) {
                case 'time':
                    result = new Date().toLocaleString();
                    break;
                case 'calculator':
                    result = eval(args.expression);
                    break;
                case 'list_files':
                    result = await fs.promises.readdir(process.cwd());
                    break;
                default:
                    throw new Error(`未知的工具: ${name}`);
            }
            results.push({ name, result });
        } catch (error) {
            results.push({ name, error: error.message });
        }
    }
    
    return results;
}

// 定义路由函数
const shouldContinue = (state) => {
    const { messages } = state;
    const lastMessage = messages[messages.length - 1];
    
    // 检查是否有工具调用
    if (lastMessage?.additional_kwargs?.tool_calls?.length > 0) {
        return "tools";
    }
    
    // 检查是否是 SQL 语句
    if (typeof lastMessage.content === 'string') {
        const content = lastMessage.content.trim().toUpperCase();
        
        // 检查是否是查询语句
        if (content.startsWith('SELECT')) {
            return "tools";
        }
        
        // 检查是否是增删改语句
        if (content.startsWith('INSERT') || content.startsWith('UPDATE') || content.startsWith('DELETE')) {
            return "tools";
        }
    }
    
    return "__end__";
};

// 生成对话摘要的函数
async function generateSummary(state) {
    const { messages } = state;
    
    // 构建摘要提示
    const summaryPrompt = `请总结以下对话的要点，保持简洁：\n${messages
        .map(m => `${m.type === 'human' ? '用户' : 'AI'}: ${m.content}`)
        .join('\n')}`;
    
    // 调用模型生成摘要
    const response = await model.invoke([new HumanMessage(summaryPrompt)]);
    
    // 更新状态
    return {
        messages: [
            // 保留最后两条消息
            ...messages.slice(-2),
            // 添加摘要消息
            new AIMessage(`[历史摘要]: ${response.content}`)
        ],
        turns: state.turns + 1
    };
}

// 判断是否需要生成摘要
function shouldGenerateSummary(state) {
    const { messages } = state;
    // 当消息数量超过4条时，生成摘要
    if (messages.length > 4) {
        return "summarize_conversation";
    }
    return "model";
}

// 创建对话图
async function createConversationGraph() {
    const { StateGraph, END } = await import('@langchain/langgraph');
    
    const graph = new StateGraph({
        channels: {
            messages: [],
            turns: 0
        }
    });

    // 添加节点
    graph.addNode("agent", callModel);
    graph.addNode("summarize_conversation", generateSummary);

    // 添加边
    graph.addEdge("agent", "summarize_conversation");
    graph.addEdge("summarize_conversation", END);

    // 设置入口
    graph.setEntryPoint("agent");

    return graph.compile();
}

// 测试函数
async function testStreamWithTools() {
    const graph = await createConversationGraph();
    const question = "现在几点了？";
    
    console.log(`[问题] ${question}\n`);
    
    // 创建初始状态
    const initialState = {
        messages: [new HumanMessage(question)],
        turns: 0
    };
    
    // 使用 invoke 替代 streamEvents
    try {
        const result = await graph.invoke(initialState);
        
        // 格式化输出
        console.log("[回答]");
        for (const message of result.messages) {
            if (message instanceof AIMessage) {
                if (message.content.startsWith('[历史摘要]')) {
                    console.log(`\n${message.content}`);
                } else if (message.content) {
                    console.log(`助手: ${message.content}`);
                }
            } else if (message instanceof HumanMessage) {
                console.log(`用户: ${message.content}`);
            }
            
            // 如果有工具调用，执行并显示结果
            if (message.additional_kwargs?.tool_calls) {
                const toolResults = await executeToolCalls(message.additional_kwargs.tool_calls);
                for (const { name, result, error } of toolResults) {
                    console.log(`\n[工具调用] ${name}`);
                    if (error) {
                        console.log(`错误: ${error}`);
                    } else {
                        console.log(`结果: ${result}`);
                    }
                }
            }
        }
        
        return result;
    } catch (error) {
        console.error("[错误] 运行出错:", error);
        throw error;
    }
}

// 主函数
async function main() {
    try {
        console.log("[信息] 正在设置环境...");
        await setupEnvironment();
        
        // 根据命令行参数决定运行模式
        const args = process.argv.slice(2);
        const mode = args[0] || 'prod';
        const testType = args[1] || 'stream';
        
        if (mode === 'test') {
            switch (testType) {
                case 'stream':
                    console.log("[信息] \n=== 开始流式输出测试 ===\n");
                    await testStreamWithTools();
                    break;
                case 'history':
                    console.log("[信息] \n=== 开始历史记录验证测试 ===\n");
                    await testHistoryVerification();
                    break;
                case 'sql':
                    console.log("[信息] \n=== 开始 SQL 测试 ===\n");
                    await testSqlQueries();
                    break;
                case 'nldb':
                    console.log("[信息] \n=== 开始自然语言数据库测试 ===\n");
                    await testNaturalLanguageDB();
                    break;
                case 'all':
                    console.log("[信息] \n=== 开始全部测试 ===\n");
                    await testStreamWithTools();
                    await testHistoryVerification();
                    await testSqlQueries();
                    await testNaturalLanguageDB();
                    break;
                default:
                    console.log("[信息] 可用的测试类型：stream, history, sql, nldb, all");
                    break;
            }
        } else if (mode === 'dev') {
            // 开发模式：交互式测试
            console.log("[信息] 开发模式启动...");
            await runDevMode();
        } else {
            // 生产模式：主要功能
            console.log("[信息] 生产模式启动...");
            await runProdMode();
        }
        
        console.log("[成功] \n运行完成！");
    } catch (error) {
        console.error("[错误] 运行失败:", error);
        process.exit(1);
    }
}

// 构建图
const memory = new MemorySaver();
// const graph = new StateGraph(StateAnnotation)
//     .addNode("model", callModel)
//     .addNode("summarize_conversation", generateSummary)
//     .addNode("tools", callTools)
//     .addEdge("model", shouldGenerateSummary)
//     .addEdge("summarize_conversation", "model")
//     .addEdge("model", shouldContinue)
//     .addEdge("tools", "model")
//     .setEntryPoint("model");

const graph = new StateGraph(StateAnnotation)
    .addNode("model", callModel)
    .addNode("tools", callTools)
    .addEdge("__start__", "model")
    .addConditionalEdges("model", shouldContinue, {
        tools: "tools",
        __end__: "__end__",
    })
    .addEdge("tools", "model")
    .compile({ checkpointer: memory });

// 交互式测试函数
async function testInteractive() {
    try {
        logger.info('开始交互式测试...');
        console.log("你可以输入任何问题，输入 'exit' 结束测试");
        
        const sessionConfig = { 
            configurable: { 
                thread_id: `interactive-${Date.now()}` 
            },
            version: "v2"
        };
        
        const readline = createInterface({ input, output });
        const question = (query) => new Promise((resolve) => readline.question(query, resolve));

        while (true) {
            const input = await question('\n请输入你的问题: ');
            
            if (input.toLowerCase() === 'exit') {
                logger.info('测试结束！');
                readline.close();
                break;
            }

            try {
                logger.step('处理用户输入...');
                const eventStream = await graph.streamEvents(
                    { 
                        messages: [new HumanMessage(input)],
                        turns: 0
                    },
                    sessionConfig
                );

                process.stdout.write("助手: ");
                for await (const { event, name, data } of eventStream) {
                    if (event === "on_chat_model_stream") {
                        if (data.chunk.content) {
                            process.stdout.write(data.chunk.content);
                        }
                    }
                }
                console.log("\n");
                
            } catch (error) {
                logger.error(`处理失败: ${error.message}`);
            }
        }

    } catch (error) {
        logger.error(`测试过程出错: ${error.message}`);
    }
}

// 历史记录验证测试
async function testHistoryVerification() {
    try {
        logger.info("\n=== 开始历史记录验证测试 ===\n");
        
        // 创建会话配置
        const sessionConfig = { 
            configurable: { 
                thread_id: `history-test-${Date.now()}` 
            },
            version: "v2"
        };

        // 创建图
        const graph = await createConversationGraph();

        // 测试对话序列
        const conversations = [
            {
                question: "现在几点了？",
                expectedContext: "时间"
            },
            {
                question: "你能告诉我刚才说的时间吗？",
                expectedContext: "之前提到的时间"
            },
            {
                question: "计算 23 + 45 是多少？",
                expectedContext: "计算"
            },
            {
                question: "把刚才的结果乘以2",
                expectedContext: "之前的计算结果"
            },
            {
                question: "列出数据库中的所有表",
                expectedContext: "数据库表"
            },
            {
                question: "查看users表的结构",
                expectedContext: "数据库表结构"
            }
        ];

        let currentState = { messages: [], turns: 0 };

        for (const conversation of conversations) {
            logger.info(`\n问题: ${conversation.question}`);
            logger.info(`期望上下文: ${conversation.expectedContext}`);
            
            // 更新状态
            currentState = {
                ...currentState,
                messages: [...currentState.messages, new HumanMessage(conversation.question)]
            };
            
            const eventStream = await graph.streamEvents(
                currentState,
                sessionConfig
            );

            let response = "";
            process.stdout.write("助手: ");
            for await (const { event, name, data } of eventStream) {
                if (event === "on_chat_model_stream") {
                    if (data.chunk.content) {
                        process.stdout.write(data.chunk.content);
                        response += data.chunk.content;
                    }
                }
            }
            console.log("\n");

            // 获取当前状态
            const state = await memory.get(sessionConfig.configurable);
            if (state) {
                logger.info(`消息历史数量: ${state.messages.length}`);
                logger.info(`对话轮次: ${state.turns}`);
            }
        }

        logger.success("历史记录验证测试完成！");

    } catch (error) {
        logger.error("历史记录验证测试失败:");
        console.error(error);
    }
}

// SQL CRUD 测试函数
async function testSQLCRUD() {
    console.log(chalk.blue('[信息] \n=== 开始 SQL CRUD 测试 ===\n'));

    // 设置测试模式
    process.env.NODE_ENV = 'test';

    try {
        // 1. 创建测试表
        console.log(chalk.blue('[测试] 1. 创建测试表'));
        await datasource.query(`
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                stock INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log(chalk.green('[成功] 创建表成功\n'));

        // 2. 插入测试数据
        console.log(chalk.blue('[测试] 2. 插入测试数据'));
        const insertTool = new SQLExecutionTool(datasource);
        
        // 2.1 插入单条数据
        console.log(chalk.blue('2.1 插入单条数据'));
        let insertResult = await insertTool.call({
            query: "INSERT INTO products (name, category, price, stock) VALUES ('智能音箱', '电子产品', 299.99, 100)"
        });
        console.log(chalk.blue('[信息] 插入结果:'), formatResult(insertResult));

        // 2.2 插入多条数据
        console.log(chalk.blue('\n2.2 插入多条数据'));
        insertResult = await insertTool.call({
            query: `INSERT INTO products (name, category, price, stock) VALUES 
                ('无线耳机', '电子产品', 499.99, 50),
                ('智能手表', '电子产品', 1299.99, 30),
                ('运动相机', '数码产品', 2499.99, 20)`
        });
        console.log(chalk.blue('[信息] 插入结果:'), formatResult(insertResult));

        // 3. 查询测试
        console.log(chalk.blue('\n[测试] 3. 查询测试'));
        const queryTool = new SQLExecutionTool(datasource);

        // 3.1 基本查询
        console.log(chalk.blue('3.1 基本查询'));
        let queryResult = await queryTool.call({
            query: "SELECT * FROM products"
        });
        console.log(chalk.blue('[信息] 查询结果:'), formatResult(queryResult));

        // 3.2 条件查询
        console.log(chalk.blue('\n3.2 条件查询'));
        queryResult = await queryTool.call({
            query: "SELECT * FROM products WHERE category = '电子产品' AND price < 1000"
        });
        console.log(chalk.blue('[信息] 查询结果:'), formatResult(queryResult));

        // 3.3 聚合查询
        console.log(chalk.blue('\n3.3 聚合查询'));
        queryResult = await queryTool.call({
            query: "SELECT category, COUNT(*) as count, AVG(price) as avg_price FROM products GROUP BY category"
        });
        console.log(chalk.blue('[信息] 查询结果:'), formatResult(queryResult));

        // 4. 更新测试
        console.log(chalk.blue('\n[测试] 4. 更新测试'));
        const updateTool = new SQLExecutionTool(datasource);

        // 4.1 更新单条记录
        console.log(chalk.blue('4.1 更新单条记录'));
        let updateResult = await updateTool.call({
            query: "UPDATE products SET price = 399.99 WHERE name = '智能音箱'"
        });
        console.log(chalk.blue('[信息] 更新结果:'), formatResult(updateResult));

        // 4.2 更新多条记录
        console.log(chalk.blue('\n4.2 更新多条记录'));
        updateResult = await updateTool.call({
            query: "UPDATE products SET stock = stock - 10 WHERE category = '电子产品'"
        });
        console.log(chalk.blue('[信息] 更新结果:'), formatResult(updateResult));

        // 4.3 验证更新
        console.log(chalk.blue('\n4.3 验证更新'));
        queryResult = await queryTool.call({
            query: "SELECT * FROM products"
        });
        console.log(chalk.blue('[信息] 验证结果:'), formatResult(queryResult));

        // 5. 删除测试
        console.log(chalk.blue('\n[测试] 5. 删除测试'));
        const deleteTool = new SQLExecutionTool(datasource);

        // 5.1 删除单条记录
        console.log(chalk.blue('5.1 删除单条记录'));
        let deleteResult = await deleteTool.call({
            query: "DELETE FROM products WHERE name = '运动相机'"
        });
        console.log(chalk.blue('[信息] 删除结果:'), formatResult(deleteResult));

        // 5.2 删除多条记录
        console.log(chalk.blue('\n5.2 删除多条记录'));
        deleteResult = await deleteTool.call({
            query: "DELETE FROM products WHERE category = '电子产品'"
        });
        console.log(chalk.blue('[信息] 删除结果:'), formatResult(deleteResult));

        // 5.3 验证删除
        console.log(chalk.blue('\n5.3 验证删除'));
        queryResult = await queryTool.call({
            query: "SELECT * FROM products"
        });
        console.log(chalk.blue('[信息] 验证结果:'), formatResult(queryResult));

        // 6. 清理测试表
        console.log(chalk.blue('\n[测试] 6. 清理测试表'));
        await datasource.query('DROP TABLE IF EXISTS products');
        console.log(chalk.green('[成功] 清理表成功'));

        console.log(chalk.green('\n=== SQL CRUD 测试全部通过 ===\n'));
    } catch (error) {
        console.error(chalk.red('\n[错误] 测试失败:'), error);
        // 确保清理测试表
        try {
            await datasource.query('DROP TABLE IF EXISTS products');
        } catch {}
    }
}

// 测试自然语言数据库操作
async function testNLDB() {
    try {
        // 初始化数据库
        const datasource = new DataSource({
            type: CONFIG.DATABASE.TYPE,
            database: CONFIG.DATABASE.PATH
        });

        await datasource.initialize();
        console.log("数据库连接已建立");

        // 创建 SQL 执行工具
        const sqlTool = new SQLExecutionTool(datasource, model);

        // 测试用例：自然语言 -> SQL
        const testCases = [
            {
                description: "查询所有用户",
                nlQuery: "显示所有用户信息",
                expectedSQL: "SELECT * FROM users"
            },
            {
                description: "添加新用户",
                nlQuery: "添加一个新用户，名字叫张三，邮箱是zhangsan@example.com",
                expectedSQL: "INSERT INTO users (name, email, created_at) VALUES ('张三', 'zhangsan@example.com', datetime('now'))"
            },
            {
                description: "查询特定用户",
                nlQuery: "查找用户张三的信息",
                expectedSQL: "SELECT * FROM users WHERE name = '张三'"
            },
            {
                description: "更新用户信息",
                nlQuery: "更新用户张三的邮箱为zhangsan2@example.com",
                expectedSQL: "UPDATE users SET email = 'zhangsan2@example.com' WHERE name = '张三'"
            },
            {
                description: "查询所有产品",
                nlQuery: "列出所有产品的价格和描述",
                expectedSQL: "SELECT name, price, description FROM products"
            },
            {
                description: "删除用户",
                nlQuery: "删除用户张三",
                expectedSQL: "DELETE FROM users WHERE name = '张三'"
            },
            {
                description: "复杂查询",
                nlQuery: "查找价格超过3000元的产品",
                expectedSQL: "SELECT * FROM products WHERE price > 3000"
            },
            {
                description: "模糊查询",
                nlQuery: "搜索名字包含'手机'的产品",
                expectedSQL: "SELECT * FROM products WHERE name LIKE '%手机%'"
            }
        ];

        // 执行测试用例
        for (const test of testCases) {
            console.log(`\n测试: ${test.description}`);
            console.log('-'.repeat(50));
            console.log('自然语言查询:', test.nlQuery);
            console.log('期望的SQL:', test.expectedSQL);
            
            try {
                // 执行自然语言查询
                const result = await sqlTool._call({ query: test.nlQuery });
                console.log("\n执行结果:");
                console.log(result);
            } catch (error) {
                console.error(`测试失败: ${error.message}`);
            }
            
            console.log('\n' + '='.repeat(50));
        }

        await datasource.destroy();
        console.log("\n数据库连接已关闭");
        
    } catch (error) {
        console.error("测试失败:", error);
    }
}

function formatResult(result) {
    try {
        const parsed = JSON.parse(result);
        return JSON.stringify(parsed, null, 2);
    } catch {
        return result;
    }
}

// 定义事件处理器
const streamHandler = async ({ event, name, data }) => {
    if (event === 'on_chat_model_start') {
        logger.toolCall('开始调用模型...');
    } else if (event === 'on_tool_start') {
        logger.toolCall('开始执行工具调用...');
    } else if (event === 'on_chat_model_stream') {
        if (data.chunk.content) {
            process.stdout.write(data.chunk.content);
        }
    } else if (event === 'on_tool_end') {
        logger.toolCall('工具调用完成');
    } else if (event === 'on_chat_model_end') {
        logger.toolCall('模型调用完成');
    }
};

// 运行模式
const [mode, testType] = process.argv.slice(2).map(arg => arg?.toLowerCase());

// 测试类型映射
const TEST_TYPES = {
    stream: testStreamWithTools,
    history: testHistoryVerification,
    sql: testSQLCRUD,
    nldb: testNLDB,
    all: async () => {
        await testStreamWithTools();
        await testHistoryVerification();
        await testSQLCRUD();
        await testNLDB();
    }
};

logger.info('正在设置环境...');
try {
    switch (mode) {
        case 'test':
            // 测试模式
            if (!testType) {
                logger.info('可用的测试类型：' + Object.keys(TEST_TYPES).join(', '));
                process.exit(0);
            }
            const testFn = TEST_TYPES[testType];
            if (!testFn) {
                logger.error('未知的测试类型：' + testType);
                process.exit(1);
            }
            await testFn();
            break;
            
        case 'dev':
            // 开发模式：交互式测试
            await testInteractive();
            break;
            
        case 'prod':
        default:
            // 生产模式：主要功能
            await testStreamWithTools();
    }
    logger.success('\n运行完成！');
} catch (error) {
    logger.error('运行失败:', error);
    process.exit(1);
}

// 如果直接运行此文件则执行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}
