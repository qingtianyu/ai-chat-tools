import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import eventManager from './event-manager.js';

dotenv.config();

export class RAGService {
    constructor(config = {}) {
        // RAG 配置选项
        this.config = {
            // 文档分割配置
            chunkSize: config.chunkSize || 1000,
            chunkOverlap: config.chunkOverlap || 200,
            
            // 检索配置
            maxRetrievedDocs: config.maxRetrievedDocs || 5,
            minRelevanceScore: config.minRelevanceScore || 0.9,
            
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
        this._enabled = true; // RAG 服务启用状态
        this._mode = 'single'; // RAG 服务模式

        // 初始化状态持久化
        this._loadState();
    }

    // 状态持久化方法
    async _saveState() {
        try {
            const state = {
                enabled: this._enabled,
                mode: this._mode,
                currentKnowledgeBase: this.currentKnowledgeBase
            };
            await fs.writeFile(
                path.join(process.cwd(), 'rag-state.json'),
                JSON.stringify(state, null, 2)
            );
        } catch (error) {
            console.error('保存 RAG 状态失败:', error);
        }
    }

    async _loadState() {
        try {
            const statePath = path.join(process.cwd(), 'rag-state.json');
            const data = await fs.readFile(statePath, 'utf8');
            const state = JSON.parse(data);
            this._enabled = state.enabled;
            this._mode = state.mode;
            this.currentKnowledgeBase = state.currentKnowledgeBase;
            
            // 发出状态加载事件
            eventManager.emit('rag:stateLoaded', {
                enabled: this._enabled,
                mode: this._mode,
                currentKnowledgeBase: this.currentKnowledgeBase
            });
        } catch (error) {
            // 如果文件不存在，使用默认值
            console.log('使用默认 RAG 状态');
        }
    }

    // 模式的 getter 和 setter
    get mode() {
        return this._mode;
    }

    set mode(newMode) {
        if (newMode !== 'single' && newMode !== 'multi') {
            throw new Error('无效的 RAG 模式。支持的模式: single, multi');
        }
        const oldMode = this._mode;
        this._mode = newMode;
        
        // 发出模式变更事件
        eventManager.emit('rag:modeChanged', {
            oldMode,
            newMode,
            timestamp: new Date()
        });
        
        this._saveState();
    }

    // 启用状态的 getter 和 setter
    get enabled() {
        return this._enabled;
    }

    set enabled(value) {
        const oldValue = this._enabled;
        this._enabled = value;
        
        // 发出状态变更事件
        eventManager.emit('rag:enabledChanged', {
            oldValue,
            newValue: value,
            timestamp: new Date()
        });
        
        this._saveState();
    }

    // 获取所有知识库列表
    async listKnowledgeBases() {
        try {
            const docsPath = path.join(process.cwd(), 'docs');
            const files = await fs.readdir(docsPath);
            const kbs = files
                .filter(file => file.endsWith('.txt'))
                .map(file => ({
                    name: path.basename(file, '.txt'),
                    path: path.join(docsPath, file),
                    active: this.currentKnowledgeBase === path.basename(file, '.txt') || 
                           this.vectorStores.has(path.basename(file, '.txt'))
                }));
            return kbs;
        } catch (error) {
            console.error('Error listing knowledge bases:', error);
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

    // 加载所有知识库
    async loadAllKnowledgeBases() {
        try {
            const kbs = await this.listKnowledgeBases();
            console.log(`开始加载 ${kbs.length} 个知识库...`);
            
            for (const kb of kbs) {
                if (!this.vectorStores.has(kb.name)) {
                    console.log(`加载知识库: ${kb.name}`);
                    await this.initializeKnowledgeBase(kb.path, kb.name);
                }
            }
            
            return {
                success: true,
                message: `成功加载 ${this.vectorStores.size} 个知识库`
            };
        } catch (error) {
            console.error('加载知识库失败:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }

    // 获取 RAG 服务状态
    async getStatus() {
        const kbs = Array.from(this.vectorStores.keys());
        const docCount = kbs.reduce((total, kb) => {
            const store = this.vectorStores.get(kb);
            return total + (store?.memoryVectors?.length || 0);
        }, 0);

        // 在多知识库模式下，显示所有已加载的知识库
        const currentKB = kbs.length > 1 ? 
            kbs.join(', ') : 
            (this.currentKnowledgeBase || null);

        return {
            isInitialized: this.vectorStores.size > 0,
            currentKnowledgeBase: currentKB,
            documentCount: docCount,  
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
    async processMessage(message, options = {}) {
        // 验证输入
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            throw new Error('查询内容不能为空');
        }

        if (!this.enabled) {
            throw new Error('RAG 服务未启用');
        }

        const mode = options.mode || this.mode;
        
        if (mode === 'single') {
            if (!this.currentKnowledgeBase || !this.vectorStores.has(this.currentKnowledgeBase)) {
                throw new Error('没有激活的知识库');
            }
            
            const vectorStore = this.vectorStores.get(this.currentKnowledgeBase);
            const results = await vectorStore.similaritySearchWithScore(
                message,
                this.config.maxRetrievedDocs
            );
            
            const relevantDocs = results
                .filter(([_, score]) => score >= this.config.minRelevanceScore)
                .map(([doc, score]) => ({
                    content: doc.pageContent,
                    score: score,
                    knowledgeBase: this.currentKnowledgeBase
                }));

            if (relevantDocs.length === 0) {
                throw new Error('没有找到相关的知识库内容');
            }

            const context = relevantDocs
                .map((doc, index) => 
                    `\n引用 ${index + 1} (知识库: ${doc.knowledgeBase}, 相关度: ${(doc.score * 100).toFixed(1)}%):\n${doc.content}`
                )
                .join('\n');

            return {
                context,
                documents: relevantDocs,
                metadata: {
                    knowledgeBase: this.currentKnowledgeBase,
                    matchCount: relevantDocs.length,
                    references: relevantDocs.map((doc, index) => ({
                        id: index + 1,
                        score: doc.score,
                        knowledgeBase: doc.knowledgeBase,
                        excerpt: doc.content
                    }))
                }
            };
        } else if (mode === 'multi') {
            return await this.multiSearch(message);
        } else {
            throw new Error(`不支持的模式: ${mode}`);
        }
    }

    // 多知识库并行查询
    async multiSearch(message) {
        // 确保 RAG 服务已启用
        if (!this.enabled) {
            throw new Error('RAG 服务未启用');
        }

        // 获取所有已加载的知识库
        const activeKbs = Array.from(this.vectorStores.keys());
        if (!activeKbs.length) {
            throw new Error('没有可用的知识库');
        }

        console.log(`开始并行查询 ${activeKbs.length} 个知识库:`, activeKbs);
        
        // 并行执行查询
        const results = await Promise.all(
            activeKbs.map(async kbName => {
                try {
                    const vectorStore = this.vectorStores.get(kbName);
                    if (!vectorStore) {
                        console.error(`知识库 ${kbName} 未找到`);
                        return [];
                    }
                    
                    const searchResults = await vectorStore.similaritySearchWithScore(
                        message, 
                        this.config.maxRetrievedDocs
                    );
                    
                    // 为每个结果添加来源信息
                    return searchResults
                        .filter(([_, score]) => score >= this.config.minRelevanceScore)
                        .map(([doc, score]) => ({
                            content: doc.pageContent,
                            score: score,
                            knowledgeBase: kbName
                        }));
                } catch (error) {
                    console.error(`查询知识库 ${kbName} 失败:`, error);
                    return [];
                }
            })
        );
        
        // 合并结果并排序
        const mergedResults = results
            .flat()
            .sort((a, b) => b.score - a.score)
            .slice(0, this.config.maxRetrievedDocs);

        if (!mergedResults.length) {
            throw new Error('没有找到相关的知识库内容');
        }

        // 构建引用文本
        const references = mergedResults
            .map((doc, index) => 
                `\n引用 ${index + 1} (知识库: ${doc.knowledgeBase}, 相关度: ${(doc.score * 100).toFixed(1)}%):\n${doc.content}`
            )
            .join('\n');

        // 返回结果
        return {
            context: references,
            documents: mergedResults,
            metadata: {
                knowledgeBases: activeKbs,
                matchCount: mergedResults.length,
                references: mergedResults.map((doc, index) => ({
                    id: index + 1,
                    score: doc.score,
                    knowledgeBase: doc.knowledgeBase,
                    excerpt: doc.content
                }))
            }
        };
    }
}
