import { RAGService } from '../src/services/rag-service.js';
import { expect } from 'chai';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('RAG 服务测试', function() {
    this.timeout(30000); // 增加超时时间到 30 秒

    let ragService;
    const testKnowledgeBasePath = path.join(__dirname, '../docs');
    
    beforeEach(() => {
        // 初始化 RAG 服务
        ragService = new RAGService({
            chunkSize: 1000,
            chunkOverlap: 200,
            maxRetrievedDocs: 5,
            minRelevanceScore: 0.7,
            kbDir: testKnowledgeBasePath
        });
    });

    describe('知识库管理', () => {
        it('应该能列出可用的知识库', async () => {
            const kbs = await ragService.listKnowledgeBases();
            expect(kbs).to.be.an('array');
            expect(kbs.length).to.be.greaterThan(0);
            expect(kbs[0]).to.have.property('name');
            expect(kbs[0]).to.have.property('path');
        });

        it('应该能切换到指定的知识库', async () => {
            const result = await ragService.switchKnowledgeBase('agent-article');
            expect(result.success).to.be.true;
            const status = await ragService.getStatus();
            expect(status.currentKnowledgeBase).to.equal('agent-article');
            expect(status.isInitialized).to.be.true;
        });

        it('切换到不存在的知识库时应该失败', async () => {
            const result = await ragService.switchKnowledgeBase('non-existent-kb');
            expect(result.success).to.be.false;
            expect(result.message).to.include('不存在');
        });
    });

    describe('RAG 处理', () => {
        before(async () => {
            // 确保切换到测试知识库
            await ragService.switchKnowledgeBase('agent-article');
        });

        it('应该能处理查询并返回相关文档', async () => {
            ragService.enabled = true;
            ragService.config.minRelevanceScore = 0.7;
            await ragService.switchKnowledgeBase('agent-article');
            
            const query = '什么是 Agent？';
            const result = await ragService.processMessage(query);
            
            expect(result).to.have.property('context');
            expect(result.documents).to.be.an('array');
            expect(result.documents.length).to.be.greaterThan(0);
            expect(result.metadata.knowledgeBase).to.equal('agent-article');
        });

        it('当没有找到相关文档时应该抛出错误', async () => {
            // 确保 RAG 服务已启用并设置了知识库
            ragService.enabled = true;
            ragService.config.minRelevanceScore = 0.99; // 设置一个很高的相关性阈值
            await ragService.switchKnowledgeBase('agent-article');
            
            const query = '这是一个完全不相关的查询XYZABC';
            
            let thrownError = null;
            try {
                await ragService.processMessage(query);
            } catch (error) {
                thrownError = error;
            }
            
            expect(thrownError).to.not.be.null;
            expect(thrownError.message).to.equal('没有找到相关的知识库内容');

            // 恢复相关性阈值
            ragService.config.minRelevanceScore = 0.7;
        });
    });

    describe('状态管理', () => {
        it('应该返回正确的状态', async () => {
            const status = await ragService.getStatus();
            expect(status).to.have.property('isInitialized');
            expect(status).to.have.property('currentKnowledgeBase');
            expect(status).to.have.property('documentCount');
            expect(status).to.have.property('chunkSize');
            expect(status).to.have.property('chunkOverlap');
            
            expect(status.isInitialized).to.be.a('boolean');
            expect(status.documentCount).to.be.a('number');
        });
    });

    describe('知识库检索测试', () => {
        it('应该能检索到自然语言处理相关的内容', async () => {
            ragService.enabled = true;
            ragService.config.minRelevanceScore = 0.7; // 重置相关性阈值
            await ragService.switchKnowledgeBase('test-kb');
            
            const query = '什么是自然语言处理？';
            const result = await ragService.processMessage(query);
            
            expect(result).to.have.property('context');
            expect(result.documents).to.be.an('array');
            expect(result.documents.length).to.be.greaterThan(0);
            expect(result.documents[0].content).to.include('自然语言处理');
        });

        it('应该能检索到对话管理相关的内容', async () => {
            ragService.enabled = true;
            ragService.config.minRelevanceScore = 0.7; // 重置相关性阈值
            await ragService.switchKnowledgeBase('test-kb');
            
            const query = '如何管理对话上下文？';
            const result = await ragService.processMessage(query);
            
            expect(result).to.have.property('context');
            expect(result.documents).to.be.an('array');
            expect(result.documents.length).to.be.greaterThan(0);
            expect(result.documents[0].content).to.include('对话');
        });
    });

    describe('RAG 模式管理', () => {
        it('单知识库模式应该正常工作', async () => {
            ragService.enabled = true;
            ragService.config.minRelevanceScore = 0.7; // 重置相关性阈值
            ragService.mode = 'single';
            await ragService.switchKnowledgeBase('agent-article');
            
            const result = await ragService.processMessage('什么是 Agent？');
            
            expect(result).to.have.property('context');
            expect(result.documents).to.be.an('array');
            expect(result.documents.length).to.be.greaterThan(0);
            expect(result.metadata.knowledgeBase).to.equal('agent-article');
        });

        it('多知识库模式应该正常工作', async () => {
            ragService.enabled = true;
            ragService.config.minRelevanceScore = 0.7; // 重置相关性阈值
            ragService.mode = 'multi';
            await ragService.loadAllKnowledgeBases();
            
            const result = await ragService.processMessage('什么是对话管理？');
            
            expect(result).to.have.property('context');
            expect(result.documents).to.be.an('array');
            expect(result.documents.length).to.be.greaterThan(0);
            expect(result.metadata.knowledgeBases).to.be.an('array');
        });

        it('禁用状态应该被正确处理', async () => {
            ragService.enabled = false;
            
            try {
                await ragService.processMessage('test query');
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.equal('RAG 服务未启用');
            }
        });
    });

    describe('错误处理', () => {
        it('单知识库模式下应该正确处理找不到知识库的情况', async () => {
            ragService.enabled = true;
            ragService.mode = 'single';
            ragService.currentKnowledgeBase = null;
            
            try {
                await ragService.processMessage('test query');
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.equal('没有激活的知识库');
            }
        });

        it('多知识库模式下应该正确处理没有可用知识库的情况', async () => {
            // 确保 RAG 服务已启用并清空知识库
            ragService.enabled = true;
            ragService.mode = 'multi';
            ragService.vectorStores.clear();
            
            let error = null;
            try {
                await ragService.multiSearch('test query');
            } catch (e) {
                error = e;
            }
            
            expect(error).to.not.be.null;
            expect(error.message).to.equal('没有可用的知识库');
        });
    });
});
