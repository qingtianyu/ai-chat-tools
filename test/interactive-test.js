import { RAGService } from '../src/services/rag-service.js';

// 创建 RAG 服务实例
const ragService = new RAGService({
    chunkSize: 1000,
    chunkOverlap: 200,
    maxRetrievedDocs: 5,
    minRelevanceScore: 0.7
});

// 测试函数
async function testRAGService() {
    try {
        console.log('\n=== RAG 服务交互式测试 ===\n');

        // 1. 测试列出知识库
        console.log('1. 列出可用的知识库：');
        const kbs = await ragService.listKnowledgeBases();
        console.log(kbs);

        // 2. 测试切换到单个知识库
        console.log('\n2. 切换到 agent-article 知识库：');
        const switchResult = await ragService.switchKnowledgeBase('agent-article');
        console.log(switchResult);

        // 3. 测试单知识库查询
        console.log('\n3. 测试单知识库查询：');
        ragService.mode = 'single';
        const singleResult = await ragService.processMessage('什么是 Agent？');
        console.log('查询结果：', singleResult);

        // 4. 测试多知识库模式
        console.log('\n4. 测试多知识库模式：');
        ragService.mode = 'multi';
        const multiResult = await ragService.processMessage('如何管理对话上下文？');
        console.log('查询结果：', multiResult);

        // 5. 测试相关性阈值调整
        console.log('\n5. 测试相关性阈值调整：');
        
        // 5.1 测试高相关性阈值
        console.log('\n5.1 测试高相关性阈值（0.9）：');
        ragService.config.minRelevanceScore = 0.9;
        try {
            await ragService.processMessage('什么是自然语言处理？');
        } catch (error) {
            console.log('预期的错误（高阈值）：', error.message);
        }
        
        // 5.2 测试低相关性阈值
        console.log('\n5.2 测试低相关性阈值（0.5）：');
        ragService.config.minRelevanceScore = 0.5;
        const lowThresholdResult = await ragService.processMessage('什么是自然语言处理？');
        console.log('匹配文档数：', lowThresholdResult.documents.length);
        
        // 恢复默认阈值
        ragService.config.minRelevanceScore = 0.7;

        // 6. 测试并发查询
        console.log('\n6. 测试并发查询：');
        const queries = [
            '什么是 Agent？',
            '如何管理对话上下文？',
            '任务分解是什么？'
        ];
        console.log('开始并发查询...');
        const startTime = Date.now();
        const results = await Promise.all(
            queries.map(query => ragService.processMessage(query))
        );
        const endTime = Date.now();
        console.log(`并发查询完成，耗时：${endTime - startTime}ms`);
        console.log('查询结果数：', results.length);

        // 7. 测试错误恢复
        console.log('\n7. 测试错误恢复：');
        
        // 7.1 测试知识库切换错误恢复
        console.log('\n7.1 测试知识库切换错误恢复：');
        try {
            await ragService.switchKnowledgeBase('non-existent-kb');
        } catch (error) {
            console.log('切换失败：', error.message);
            // 尝试恢复到有效知识库
            const recoveryResult = await ragService.switchKnowledgeBase('agent-article');
            console.log('恢复结果：', recoveryResult);
        }

        // 7.2 测试查询错误恢复
        console.log('\n7.2 测试查询错误恢复：');
        // 模拟一个失败的查询
        ragService.config.minRelevanceScore = 0.99;
        try {
            await ragService.processMessage('完全不相关的查询 XYZ123');
        } catch (error) {
            console.log('查询失败：', error.message);
            // 降低阈值重试
            ragService.config.minRelevanceScore = 0.6;
            const retryResult = await ragService.processMessage('完全不相关的查询 XYZ123');
            console.log('重试结果：', !!retryResult);
        }

        // 8. 测试错误情况
        console.log('\n8. 测试错误情况：');
        
        // 8.1 测试服务禁用
        console.log('\n8.1 测试服务禁用：');
        ragService.enabled = false;
        try {
            await ragService.processMessage('测试查询');
        } catch (error) {
            console.log('预期的错误：', error.message);
        }
        ragService.enabled = true;

        // 8.2 测试无知识库
        console.log('\n8.2 测试无知识库：');
        ragService.vectorStores.clear();
        try {
            await ragService.multiSearch('测试查询');
        } catch (error) {
            console.log('预期的错误：', error.message);
        }

        // 8.3 测试无效的查询
        console.log('\n8.3 测试无效的查询：');
        try {
            await ragService.processMessage('');
        } catch (error) {
            console.log('预期的错误：', error.message);
        }

        // 8.4 测试模式切换
        console.log('\n8.4 测试模式切换：');
        try {
            ragService.mode = 'invalid-mode';
            await ragService.processMessage('测试查询');
        } catch (error) {
            console.log('预期的错误：', error.message);
        }

    } catch (error) {
        console.error('测试过程中出现错误：', error);
    }
}

// 运行测试
console.log('开始运行交互式测试...');
testRAGService().then(() => {
    console.log('\n测试完成！');
}).catch(error => {
    console.error('测试失败：', error);
});
