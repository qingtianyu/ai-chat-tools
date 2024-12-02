import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

export class RAGService {
    constructor(config = {}) {
        // RAG 配置选项
        this.config = {
            // 文档分割配置
            chunkSize: config.chunkSize || 1000,
            chunkOverlap: config.chunkOverlap || 200,
            
            // 检索配置
            maxRetrievedDocs: config.maxRetrievedDocs || 2,
            minRelevanceScore: config.minRelevanceScore || 0.7,
            
            // 结果处理配置
            useScoreWeighting: config.useScoreWeighting ?? true,
            weightingMethod: config.weightingMethod || 'linear', // 'linear' | 'exponential'
            
            // API 重试配置
            maxRetries: config.maxRetries || 3,
            retryDelay: config.retryDelay || 5000, // 5秒
            
            // 调试配置
            debug: config.debug || false
        };
        
        // 设置知识库目录路径
        this.knowledgeBasePath = config.knowledgeBasePath || 'd:/web/app/ai-chat4/docs';
        
        // 初始化 OpenAI embeddings，添加重试逻辑
        this.embeddings = new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY,
            maxRetries: this.config.maxRetries,
            timeout: 60000
        });
        
        this.vectorStores = new Map(); // 存储多个知识库的向量存储
        this.currentKnowledgeBase = null; // 当前激活的知识库名称
    }

    // 获取所有知识库列表
    async listKnowledgeBases() {
        try {
            const files = await fs.readdir(this.knowledgeBasePath);
            return files
                .filter(file => file.endsWith('.txt'))
                .map(file => ({
                    name: path.basename(file, '.txt'),
                    path: path.join(this.knowledgeBasePath, file)
                }));
        } catch (error) {
            console.error('获取知识库列表失败:', error);
            return [];
        }
    }

    // 初始化知识库
    async initializeKnowledgeBase(filePath, name) {
        try {
            console.log(`Starting document loading from: ${filePath}`);
            
            // 读取文档内容
            const text = await fs.readFile(filePath, 'utf8');
            
            // 创建文档
            const doc = new Document({ pageContent: text });
            
            // 分割文档
            const textSplitter = new RecursiveCharacterTextSplitter({
                chunkSize: this.config.chunkSize,
                chunkOverlap: this.config.chunkOverlap
            });
            
            const docs = await textSplitter.splitDocuments([doc]);
            console.log(`Documents split into ${docs.length} chunks`);
            
            // 创建向量存储
            console.log('Creating vector store...');
            const vectorStore = await MemoryVectorStore.fromDocuments(
                docs,
                this.embeddings
            );
            
            console.log('Vector store created successfully');

            // 保存向量存储
            this.vectorStores.set(name, vectorStore);
            this.currentKnowledgeBase = name;
            console.log(`Knowledge base "${name}" initialized successfully`);
        } catch (error) {
            console.error(`Failed to initialize knowledge base "${name}":`, error);
            throw error;
        }
    }

    // 切换知识库
    async switchKnowledgeBase(knowledgeBaseName) {
        try {
            const kbs = await this.listKnowledgeBases();
            const kb = kbs.find(kb => kb.name === knowledgeBaseName);
            
            if (!kb) {
                const availableKbs = kbs.map(k => k.name).join(', ');
                return {
                    success: false,
                    message: `知识库 "${knowledgeBaseName}" 不存在。可用的知识库：${availableKbs}`
                };
            }

            await this.initializeKnowledgeBase(kb.path, knowledgeBaseName);
            
            return {
                success: true,
                message: `已切换到知识库 "${knowledgeBaseName}"`
            };
        } catch (error) {
            console.error('切换知识库失败:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }

    // 获取 RAG 服务状态
    async getStatus() {
        return {
            isInitialized: this.currentKnowledgeBase !== null,
            currentKnowledgeBase: this.currentKnowledgeBase,
            documentCount: this.currentKnowledgeBase ? 
                this.vectorStores.get(this.currentKnowledgeBase)?.memoryVectors?.length || 0 : 0,
            chunkSize: this.config.chunkSize,
            chunkOverlap: this.config.chunkOverlap
        };
    }

    // 获取知识库状态
    async getKnowledgeBaseStatus() {
        return {
            currentKnowledgeBase: this.currentKnowledgeBase,
            loadedKnowledgeBases: Array.from(this.vectorStores.keys()),
            isInitialized: this.currentKnowledgeBase !== null && this.vectorStores.has(this.currentKnowledgeBase)
        };
    }

    // 处理消息
    async processMessage(message) {
        const status = await this.getKnowledgeBaseStatus();
        if (!status.isInitialized) {
            throw new Error('没有激活的知识库');
        }

        const vectorStore = this.vectorStores.get(this.currentKnowledgeBase);
        if (!vectorStore) {
            throw new Error(`知识库 ${this.currentKnowledgeBase} 未找到`);
        }

        const results = await vectorStore.similaritySearchWithScore(message, this.config.maxRetrievedDocs);
        
        // 过滤和加权相关文档
        const relevantDocs = results
            .filter(([_, score]) => score >= this.config.minRelevanceScore)
            .map(([doc, score]) => ({
                pageContent: doc.pageContent,
                score: score,
                scoreDisplay: (score * 100).toFixed(1) + '%'
            }))
            .sort((a, b) => b.score - a.score);

        if (relevantDocs.length === 0) {
            throw new Error('没有找到相关的知识库内容');
        }

        // 构建引用文本
        const references = relevantDocs
            .map((doc, index) => `\n引用 ${index + 1} (相关度: ${doc.scoreDisplay}):\n${doc.pageContent}`)
            .join('\n');

        // 返回结果
        return {
            context: references,
            documents: relevantDocs,
            metadata: {
                knowledgeBase: this.currentKnowledgeBase,
                matchCount: relevantDocs.length,
                references: relevantDocs.map((doc, index) => ({
                    id: index + 1,
                    score: doc.score
                }))
            }
        };
    }
}
