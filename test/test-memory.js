import { VectorStoreService } from '../src/services/vector-store.js';
import { DatabaseService } from '../src/services/database.js';
import userStore from '../src/services/user-store-singleton.js';
import { chat } from '../src/chatbot.js';
import dotenv from 'dotenv';

dotenv.config();

// 测试数据
const TEST_DATA = {
    user: {
        name: "小明",
        age: 18,
        interests: ["编程", "Python", "JavaScript", "人工智能"]
    },
    // 模拟用户的对话输入
    userMessages: [
        "你好，我是小明",
        "我今年18岁，是一名学生",
        "我特别喜欢编程，最近在学Python和JavaScript",
        "我最感兴趣的是Python，因为我想学习人工智能",
        "你能推荐一些入门资料吗？",
        "我最近在学习神经网络，你能解释一下它的基本原理吗？",
        "我想做一个图像识别的项目，应该怎么开始？",
        "学习AI需要很多数学知识吗？",
        "将来我想成为一名AI工程师，需要做哪些准备？",
        "我想先做一些小项目来练手，有什么建议吗？"
    ]
};

// 初始化服务
const vectorStore = new VectorStoreService();
const db = new DatabaseService();

async function runTest() {
    try {
        console.log('=== 开始测试 ===\n');

        // 1. 初始化服务
        console.log('1. 初始化服务...');
        await Promise.all([
            userStore.initialize(),
            vectorStore.initialize(),
            db.initialize()
        ]);
        console.log('✅ 服务初始化成功\n');

        // 2. 创建测试用户
        console.log('2. 创建测试用户...');
        const userId = await userStore.generateUserId();
        await userStore.createUser(userId);
        console.log(`✅ 用户创建成功: ${userId}\n`);

        // 3. 更新用户档案
        console.log('3. 更新用户档案...');
        const userProfile = {
            name: '小明',
            age: 18,
            interests: ['编程', 'Python', 'JavaScript', '人工智能'],
            preferences: {},
            habits: []
        };
        await userStore.updateUserProfile(userId, userProfile);
        console.log('✅ 用户档案更新成功:', userProfile, '\n');

        // 4. 创建对话
        console.log('4. 创建对话...');
        const conversationId = await db.createConversation(userId);
        console.log(`✅ 对话创建成功: ${conversationId}\n`);

        // 5. 开始对话测试
        console.log('5. 开始对话测试...\n');
        const messages = [
            '你好，我是小明',
            '我今年18岁，是一名学生',
            '我特别喜欢编程，最近在学Python和JavaScript',
            '我最感兴趣的是Python，因为我想学习人工智能',
            '你能推荐一些入门资料吗？',
            '我最近在学习神经网络，你能解释一下它的基本原理吗？',
            '我想做一个图像识别的项目，应该怎么开始？',
            '学习AI需要很多数学知识吗？',
            '将来我想成为一名AI工程师，需要做哪些准备？',
            '我想先做一些小项目来练手，有什么建议吗？'
        ];

        for (const message of messages) {
            console.log('用户:', message);
            const response = await chat(message, userId, conversationId);
            console.log('AI助手:', response.messages[response.messages.length - 1].content, '\n');
        }
        console.log('✅ 对话测试完成\n');

        // 6. 测试记忆检索
        console.log('6. 测试记忆检索...\n');
        const queries = [
            'Python编程',
            '人工智能学习',
            '神经网络原理',
            '项目实践'
        ];

        for (const query of queries) {
            console.log(`查询: "${query}"`);
            const memories = await vectorStore.searchMemories(userId, query, 3);
            console.log('相关记忆:', memories, '\n');
        }

        // 7. 验证数据持久化
        console.log('7. 验证数据持久化...');
        const userData = await userStore.getUserData(userId);
        console.log('用户数据:', userData);

        const conversationData = await db.getConversation(conversationId);
        console.log('对话数据:', conversationData);

        const messageCount = await db.getMessageCount(conversationId);
        console.log('消息数量:', messageCount);

        const firstMessage = await db.getFirstMessage(conversationId);
        console.log('首条消息:', firstMessage);

        const lastMessage = await db.getLastMessage(conversationId);
        console.log('末条消息:', lastMessage);

        console.log('\n=== 测试完成 ===\n');
        console.log('✨ 所有测试通过!');
        console.log(`- 用户ID: ${userId}`);
        console.log(`- 对话ID: ${conversationId}`);
        console.log(`- 消息总数: ${messageCount}`);

    } catch (error) {
        console.log('❌ 测试失败:', error);
        throw error;
    } finally {
        // 清理资源
        if (db) {
            await db.close();
        }
    }
}

runTest().catch(console.error);
