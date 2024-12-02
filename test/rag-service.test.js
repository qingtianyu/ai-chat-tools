import { RAGService } from '../src/services/rag-service.js';
import { expect } from 'chai';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('RAG Service Tests', () => {
    let ragService;
    const testKnowledgeBasePath = path.join(__dirname, '../docs');
    
    before(() => {
        // 初始化RAG服务
        ragService = new RAGService({
            chunkSize: 1000,
            chunkOverlap: 200,
            maxRetrievedDocs: 2,
            minRelevanceScore: 0.7,
            useScoreWeighting: true,
            weightingMethod: 'linear',
            debug: true,
            knowledgeBasePath: testKnowledgeBasePath
        });
    });

    describe('Knowledge Base Management', () => {
        it('should list available knowledge bases', async () => {
            const kbs = await ragService.listKnowledgeBases();
            expect(kbs).to.be.an('array');
            expect(kbs.length).to.be.greaterThan(0);
            expect(kbs[0]).to.have.property('name');
            expect(kbs[0]).to.have.property('path');
        });

        it('should switch to a knowledge base', async () => {
            const result = await ragService.switchKnowledgeBase('agent-article');
            expect(result.success).to.be.true;
            
            const status = await ragService.getStatus();
            expect(status.currentKnowledgeBase).to.equal('agent-article');
            expect(status.isInitialized).to.be.true;
        });

        it('should fail to switch to non-existent knowledge base', async () => {
            const result = await ragService.switchKnowledgeBase('non-existent-kb');
            expect(result.success).to.be.false;
            expect(result.message).to.include('不存在');
        });
    });

    describe('RAG Processing', () => {
        before(async () => {
            // 确保切换到测试知识库
            await ragService.switchKnowledgeBase('agent-article');
        });

        it('should process a query and return relevant documents', async () => {
            const query = 'AI代理中的任务分解如何做';
            const result = await ragService.processMessage(query);
            
            expect(result).to.have.property('answer');
            expect(result).to.have.property('context');
            expect(result).to.have.property('documents');
            expect(result).to.have.property('metadata');
            
            expect(result.documents).to.be.an('array');
            expect(result.documents.length).to.be.greaterThan(0);
            
            expect(result.metadata).to.have.property('knowledgeBase');
            expect(result.metadata).to.have.property('matchCount');
            expect(result.metadata).to.have.property('references');
        });

        it('should handle queries with no relevant documents', async () => {
            const query = '这是一个完全不相关的查询XYZABC';
            const result = await ragService.processMessage(query);
            
            // 检查返回的文档相关度是否都很低
            expect(result.documents).to.be.an('array');
            result.documents.forEach(doc => {
                expect(doc.score).to.be.lessThan(0.8); // 相关度应该较低
            });
        });
    });

    describe('Status Management', () => {
        it('should return correct status', async () => {
            const status = await ragService.getStatus();
            expect(status).to.have.property('currentKnowledgeBase');
            expect(status).to.have.property('loadedKnowledgeBases');
            expect(status).to.have.property('isInitialized');
            
            expect(status.loadedKnowledgeBases).to.be.an('array');
            expect(status.isInitialized).to.be.a('boolean');
        });
    });

    describe('Knowledge Base Retrieval Tests', () => {
        it('should retrieve relevant content for natural language processing query', async () => {
            // 初始化知识库
            await ragService.initializeKnowledgeBase('d:/web/app/ai-chat4/docs/test-kb.txt', 'test-kb');
            
            // 测试查询
            const query = "AI助手在自然语言处理方面有哪些功能？";
            const result = await ragService.processMessage(query);
            
            // 打印检索结果
            console.log('\n=== RAG 检索结果 ===');
            console.log('查询:', query);
            console.log('匹配文档数:', result.documents.length);
            console.log('相关度分数:', result.documents.map(doc => 
                `${(doc.score * 100).toFixed(1)}%`
            ).join(', '));
            
            console.log('\n检索到的内容片段:');
            result.documents.forEach((doc, index) => {
                console.log(`\n片段 ${index + 1} (相关度: ${(doc.score * 100).toFixed(1)}%):`);
                console.log(doc.pageContent);
            });
            
            // 验证结果
            expect(result.documents.length > 0, '应该检索到至少一个相关文档');
            expect(result.documents[0].score >= 0.7, '最高相关度应该大于 0.7');
            expect(result.documents[0].pageContent.includes('自然语言'), '检索内容应该包含关键词');
        });
        
        it('should retrieve relevant content for conversation management query', async () => {
            const query = "AI助手是如何管理对话的？";
            const result = await ragService.processMessage(query);
            
            console.log('\n=== RAG 检索结果 ===');
            console.log('查询:', query);
            console.log('匹配文档数:', result.documents.length);
            console.log('相关度分数:', result.documents.map(doc => 
                `${(doc.score * 100).toFixed(1)}%`
            ).join(', '));
            
            console.log('\n检索到的内容片段:');
            result.documents.forEach((doc, index) => {
                console.log(`\n片段 ${index + 1} (相关度: ${(doc.score * 100).toFixed(1)}%):`);
                console.log(doc.pageContent);
            });
            
            expect(result.documents.length > 0, '应该检索到至少一个相关文档');
            expect(result.documents[0].score >= 0.7, '最高相关度应该大于 0.7');
            expect(result.documents[0].pageContent.includes('对话'), '检索内容应该包含关键词');
        });
    });
});
