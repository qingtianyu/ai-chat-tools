import ChatService from '../../../src/services/chat/ChatService.js';
import UserService from '../../../src/services/user/UserService.js';
import { RAGService } from '../../../src/services/rag-service.js';
import MessageProcessor from '../../../src/services/chat/MessageProcessor.js';
import fs from 'fs/promises';
import path from 'path';

async function prepareTestDocuments() {
    const testDocsDir = path.join(process.cwd(), 'test', 'data', 'docs');
    
    // 确保测试文档目录存在
    await fs.mkdir(testDocsDir, { recursive: true });

    // 创建测试文档
    const testDocs = [
        {
            filename: 'ai.txt',
            content: '人工智能（AI）是计算机科学的一个分支，致力于创建能够模仿人类智能的系统。' +
                     '它包括机器学习、深度学习、自然语言处理等多个领域。' +
                     '现代AI系统能够理解语言、识别图像、下棋和驾驶汽车等。'
        },
        {
            filename: 'programming.txt',
            content: '编程是编写计算机程序的过程。常用的编程语言包括Python、JavaScript和Java。' +
                     '好的程序应该具有可读性、可维护性和效率。' +
                     '程序员需要不断学习新技术来提高编程技能。'
        }
    ];

    // 写入测试文档
    for (const doc of testDocs) {
        await fs.writeFile(
            path.join(testDocsDir, doc.filename),
            doc.content,
            'utf-8'
        );
    }

    return testDocsDir;
}

async function initializeRagService(docsDir) {
    // 初始化 RAG 服务
    const ragService = new RAGService({
        knowledgeBasePath: docsDir,
        debug: true
    });
    
    // 等待系统知识库加载完成
    await ragService._loadSystemKnowledgeBases();

    // 获取 MessageProcessor 实例并初始化 RagProcessor
    const messageProcessor = MessageProcessor.getInstance();
    const ragProcessor = messageProcessor.getRagProcessor();
    if (ragProcessor) {
        await ragProcessor.init(ragService);
    }

    return ragService;
}

async function testChatService() {
    console.log('开始测试 ChatService...');
    
    try {
        // 测试1: 实例创建
        console.log('\n测试1: 测试单例模式');
        const instance1 = ChatService.getInstance();
        const instance2 = ChatService.getInstance();
        console.assert(instance1 === instance2, '单例模式测试失败');
        console.log('✓ 单例模式测试通过');

        // 创建测试用户
        const userService = UserService.getInstance();
        const userId = 'test-user-1';
        await userService.createUser(userId);
        console.log('✓ 测试用户创建成功');

        // 测试2: 基础聊天功能
        console.log('\n测试2: 测试基础聊天功能');
        const conversationId = 'test-conversation-1';
        const userMessage = '你好，请问你是谁？';

        const result = await instance1.chat(userMessage, userId, conversationId);
        console.assert(result.success, '基础聊天功能测试失败');
        console.assert(result.messages && result.messages.length > 0, '没有返回消息');
        console.log('✓ 基础聊天功能测试通过');

        // 测试3: 工具使用测试
        console.log('\n测试3: 测试工具使用');
        
        // 测试计算器工具
        console.log('测试计算器工具...');
        const calcResult = await instance1.chat('帮我计算 123 + 456', userId, conversationId);
        console.assert(calcResult.success, '计算器工具测试失败');
        console.log('✓ 计算器工具测试通过');

        // 测试时间工具
        console.log('测试时间工具...');
        const timeResult = await instance1.chat('现在几点了？', userId, conversationId);
        console.assert(timeResult.success, '时间工具测试失败');
        console.log('✓ 时间工具测试通过');

        // 测试文件操作工具
        console.log('测试文件操作工具...');
        const fileResult = await instance1.chat('在临时目录下创建一个名为 test.txt 的文件', userId, conversationId);
        console.assert(fileResult.success, '文件操作工具测试失败');
        console.log('✓ 文件操作工具测试通过');

        // 测试4: RAG 功能测试
        console.log('\n测试4: 测试 RAG 功能');
        
        // 准备测试文档
        console.log('准备测试文档...');
        const testDocsDir = await prepareTestDocuments();
        console.log('✓ 测试文档准备完成');

        // 初始化 RAG 服务
        console.log('初始化 RAG 服务...');
        await initializeRagService(testDocsDir);
        console.log('✓ RAG 服务初始化完成');

        // 测试 AI 相关查询
        console.log('测试 AI 相关查询...');
        const aiQuery = await instance1.chat('什么是人工智能？它能做什么？', userId, conversationId);
        console.assert(aiQuery.success, 'RAG AI查询测试失败');
        console.assert(aiQuery.messages && aiQuery.messages.length > 0, 'AI 回复消息为空');
        console.log('✓ AI 查询测试通过');

        // 测试编程相关查询
        console.log('测试编程相关查询...');
        const progQuery = await instance1.chat('介绍一下编程，有哪些常用的编程语言？', userId, conversationId);
        console.assert(progQuery.success, 'RAG 编程查询测试失败');
        console.assert(progQuery.messages && progQuery.messages.length > 0, '编程回复消息为空');
        console.log('✓ 编程查询测试通过');

        // 测试5: 错误处理
        console.log('\n测试5: 测试错误处理');
        try {
            await instance1.chat(null, userId, conversationId);
        } catch (error) {
            console.log('✓ 错误处理测试通过（预期的错误被捕获）');
        }

        console.log('\n所有测试完成！');

        // 清理测试文档
        await fs.rm(testDocsDir, { recursive: true, force: true });
        console.log('✓ 测试文档清理完成');
    } catch (error) {
        console.error('测试失败:', error);
        throw error;  // 重新抛出错误以确保测试失败时退出码不为0
    }
}

// 运行测试
testChatService().catch(error => {
    console.error('测试执行失败:', error);
    process.exit(1);
});
