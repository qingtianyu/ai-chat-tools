// 导入必要的依赖
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { BufferMemory } from "langchain/memory";
import readline from 'readline';
import dotenv from 'dotenv';
import ToolManager from './toolManager.js';

// 加载 .env 文件中的环境变量
dotenv.config();

// 初始化工具管理器
const tools = new ToolManager();

// 初始化 ChatOpenAI 模型
const chat = new ChatOpenAI({
    openAIApiKey: "sk-aRUVCBaoLTtfKSfX573c06D3779a41D4B26b00F11dF9Eb37",
    modelName: "gpt-3.5-turbo",
    configuration: {
        baseURL: "https://closeproxy.unidtai.com/v1",
        timeout: 30000
    },
    streaming: true
});

// 创建记忆存储
const memory = new BufferMemory({
    returnMessages: true,
    memoryKey: "chat_history"
});

// 创建对话模板
const prompt = ChatPromptTemplate.fromMessages([
    ["system", `你是一个有帮助的AI助手，提供清晰简洁的中文回答。你需要记住用户告诉你的所有信息。
    
如果有文档内容，请在回答时结合文档内容：
{document_content}

相关文档搜索结果：
{relevant_content}

历史对话：
{chat_history}`],
    ["human", "{input}"]
]);

// 创建命令行交互接口
const rl = readline.createInterface({
    input: process.stdin,    // 标准输入
    output: process.stdout   // 标准输出
});

// 显示启动提示信息
console.log("AI助手已启动。");
console.log("- 输入 'exit' 结束对话");
console.log("- 输入 'clear' 清除对话历史");
console.log("- 输入 'load <文件路径>' 加载单个文件");
console.log("- 输入 'loaddir <目录路径>' 加载整个目录");

// 格式化历史记录
function formatHistory(history) {
    if (!history || !history.length) return "";
    return history.map(msg => `${msg.type === 'human' ? '人类' : 'AI'}: ${msg.content}`).join('\n');
}

// 处理聊天的主函数
async function chatLoop() {
    try {
        // 等待用户输入
        const question = await new Promise((resolve) => {
            rl.question('你: ', resolve);
        });

        // 检查是否退出
        if (question.toLowerCase() === 'exit') {
            console.log('再见！');
            rl.close();
            return;
        }

        // 检查是否清除历史
        if (question.toLowerCase() === 'clear') {
            await memory.clear();
            tools.clear();
            console.log('已清除对话历史和所有文档内容！');
            chatLoop();
            return;
        }

        // 检查是否加载目录
        if (question.toLowerCase().startsWith('loaddir ')) {
            const dirPath = question.slice(8).trim();
            console.log('正在加载目录...');
            const success = await tools.loadDirectory(dirPath);
            if (success) {
                console.log('目录加载成功！已自动创建向量存储。');
            } else {
                console.log('目录加载失败，请检查路径是否正确。');
            }
            chatLoop();
            return;
        }

        // 检查是否加载单个文件
        if (question.toLowerCase().startsWith('load ')) {
            const filepath = question.slice(5).trim();
            console.log('正在加载文件...');
            const success = await tools.loadCSV(filepath);
            if (success) {
                console.log('文件加载成功！已自动创建向量存储。');
            } else {
                console.log('文件加载失败，请检查文件路径是否正确。');
            }
            chatLoop();
            return;
        }

        process.stdout.write('\nAI: '); // 在用户输入后先换行，再显示AI提示符
        
        // 获取历史对话
        const memoryVariables = await memory.loadMemoryVariables({});
        const chatHistory = memoryVariables.chat_history || [];
        
        // 获取相关文档内容
        let relevantContent;
        try {
            relevantContent = await tools.searchRelevantContent(question);
        } catch (error) {
            console.error('搜索相关内容时出错:', error.message);
            relevantContent = { text: '', references: [] };
        }
        
        // 准备完整的提示内容
        const formattedPrompt = await prompt.formatMessages({
            chat_history: formatHistory(chatHistory),
            document_content: tools.getDocumentContent(),
            relevant_content: relevantContent.text,
            input: question
        });

        // 使用流式输出处理AI回答
        let fullResponse = '';
        try {
            await chat.invoke(formattedPrompt, {
                callbacks: [
                    {
                        handleLLMNewToken(token) {
                            process.stdout.write(token);
                            fullResponse += token;
                        },
                        async handleLLMEnd() {
                            // 如果有相关引用，只显示最相关的一段
                            if (relevantContent.references && relevantContent.references.length > 0) {
                                // 获取相关度最高的引用
                                const bestMatch = relevantContent.references.reduce((prev, current) => 
                                    (current.score > prev.score) ? current : prev
                                );
                                console.log(`\n\n引用来源 [相关度: ${bestMatch.score}%]: ${bestMatch.content}`);
                            }
                            
                            // 保存对话历史
                            await memory.chatHistory.addUserMessage(question);
                            await memory.chatHistory.addAIChatMessage(fullResponse.trim());
                            process.stdout.write('\n\n你: ');
                        },
                        handleLLMError(error) {
                            console.error('\n对话生成出错:', error.message);
                            if (error.cause) {
                                console.error('错误原因:', error.cause.message);
                            }
                            process.stdout.write('\n\n你: ');
                        }
                    },
                ],
            });
        } catch (error) {
            console.error('\n对话生成出错:', error.message);
            if (error.cause) {
                console.error('错误原因:', error.cause.message);
            }
            process.stdout.write('\n你: ');
        }
        
        // 继续下一轮对话
        chatLoop();
    } catch (error) {
        console.error('\n发生错误:', error.message);
        if (error.cause) {
            console.error('错误原因:', error.cause.message);
        }
        chatLoop();  // 发生错误后继续对话
    }
}

// 启动对话循环
chatLoop();
