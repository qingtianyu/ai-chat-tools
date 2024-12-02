import { chat } from '../src/chatbot.js';
import userStore from '../src/services/user-store-singleton.js';
import { RAGService } from '../src/services/rag-service.js'; 

async function testChat() {
    try {
        // 创建测试用户
        const testUser = {
            id: 'test-user-1',
            profile: {
                name: 'Test User',
                interests: ['AI', 'Programming']
            }
        };

        // 初始化 RAG 服务，使用自定义配置
        const rag = new RAGService({
            // 文档分割配置
            chunkSize: 800,
            chunkOverlap: 100,
            
            // 检索配置
            maxRetrievedDocs: 3,
            minRelevanceScore: 0.75,
            
            // 结果处理配置
            useScoreWeighting: true,
            weightingMethod: 'exponential',
            
            // 调试配置
            debug: true
        });

        // 初始化所有服务
        await Promise.all([
            userStore.initialize(),
            rag.initializeKnowledgeBase('d:/web/app/ai-chat4/docs/agent-article.txt', 'agent-article')
        ]);

        await userStore.createUser(testUser);
        console.log('Test user created successfully');

        // 测试基本对话
        console.log("\n测试 1: 基本问答");
        const response1 = await chat(
            "什么是任务分解？",
            "test-user-1",
            null
        );
        console.log("回答:", response1.messages[response1.messages.length - 1].content);
        console.log("\n-------------------\n");

        // 测试上下文相关问题
        console.log("测试 2: 上下文相关问题");
        const response2 = await chat(
            "它是如何工作的？能详细解释一下吗？",
            "test-user-1",
            response1.messages[0].conversationId
        );
        console.log("回答:", response2.messages[response2.messages.length - 1].content);
        console.log("\n-------------------\n");

        // 测试专业领域问题
        console.log("测试 3: 专业领域问题");
        const response3 = await chat(
            "使用自主代理有什么优势？",
            "test-user-1",
            response2.messages[0].conversationId
        );
        console.log("回答:", response3.messages[response3.messages.length - 1].content);

    } catch (error) {
        console.error("测试过程中出现错误:", error);
    }
}

testChat();
