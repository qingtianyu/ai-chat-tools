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
        this.knowledgeBasePath = config.knowledgeBasePath || path.join(process.cwd(), 'docs');
        
        // 初始化 OpenAI embeddings，添加重试逻辑
        this.embeddings = new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY,
            maxRetries: this.config.maxRetries,
            timeout: 60000
        });
        
        // 用户手动添加的知识库
        this.userKnowledgeBases = new Map();
        // 系统自动加载的知识库
        this.systemKnowledgeBases = new Map();
        // 系统知识库是否已加载标志
        this._systemKnowledgeBasesLoaded = false;
        // 系统知识库是否正在加载标志
        this._loadingSystemKnowledgeBases = false;
        // 当前激活的知识库名称
        this.currentKnowledgeBase = null;
        // RAG 服务启用状态
        this._enabled = true;
        // RAG 服务模式
        this._mode = 'single';

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

    // 自动加载系统知识库目录
    async _loadSystemKnowledgeBases() {
        // 添加加载锁，防止并发加载
        if (this._loadingSystemKnowledgeBases) {
            console.log('系统知识库正在加载中，跳过');
            return;
        }
        
        if (this._systemKnowledgeBasesLoaded) {
            console.log('系统知识库已加载，跳过');
            return;
        }
        
        this._loadingSystemKnowledgeBases = true;
        
        try {
            console.log(`正在扫描系统知识库目录: ${this.knowledgeBasePath}`);
            
            // 确保目录存在
            try {
                await fs.access(this.knowledgeBasePath);
            } catch (error) {
                await fs.mkdir(this.knowledgeBasePath, { recursive: true });
                console.log(`创建知识库目录: ${this.knowledgeBasePath}`);
                this._systemKnowledgeBasesLoaded = true;
                return;
            }
            
            // 获取目录下的所有文件
            const files = await fs.readdir(this.knowledgeBasePath);
            const txtFiles = files.filter(file => file.toLowerCase().endsWith('.txt'));
            
            console.log(`找到 ${txtFiles.length} 个系统知识库文件`);
            
            // 加载每个文件
            const loadPromises = txtFiles.map(async file => {
                const name = path.basename(file, '.txt');
                const filePath = path.join(this.knowledgeBasePath, file);
                
                // 如果用户知识库中已存在同名知识库，跳过
                if (this.userKnowledgeBases.has(name)) {
                    console.log(`跳过系统知识库 "${name}"：用户知识库中存在同名知识库`);
                    return;
                }
                
                // 如果系统知识库已加载，跳过
                if (this.systemKnowledgeBases.has(name)) {
                    console.log(`跳过系统知识库 "${name}"：已加载`);
                    return;
                }
                
                try {
                    const content = await fs.readFile(filePath, 'utf-8');
                    const textSplitter = new RecursiveCharacterTextSplitter({
                        chunkSize: this.config.chunkSize,
                        chunkOverlap: this.config.chunkOverlap
                    });
                    
                    console.log(`加载系统知识库: ${name}`);
                    const docs = await textSplitter.createDocuments([content]);
                    const vectorStore = await MemoryVectorStore.fromDocuments(
                        docs,
                        this.embeddings
                    );
                    
                    this.systemKnowledgeBases.set(name, {
                        store: vectorStore,
                        path: filePath,
                        active: false
                    });
                    
                    console.log(`系统知识库 "${name}" 加载成功`);
                } catch (error) {
                    console.error(`加载系统知识库 "${name}" 失败:`, error);
                }
            });
            
            // 等待所有知识库加载完成
            await Promise.all(loadPromises);
            
            // 如果没有任何知识库且加载了系统知识库，自动激活第一个
            const allKbs = this._getMergedKnowledgeBases();
            if (allKbs.size > 0 && !this.currentKnowledgeBase) {
                const firstKb = Array.from(allKbs.keys())[0];
                await this.switchKnowledgeBase(firstKb);
            }
            
            // 加载完成后设置标志
            this._systemKnowledgeBasesLoaded = true;
            
            // 发出加载完成事件
            eventManager.emit('rag:systemKnowledgeBasesLoaded', {
                count: this.systemKnowledgeBases.size,
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error('加载系统知识库失败:', error);
            this._systemKnowledgeBasesLoaded = false;
        } finally {
            this._loadingSystemKnowledgeBases = false;
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
        
        // 如果切换到 multi 模式，自动加载系统知识库
        if (newMode === 'multi' && !this._systemKnowledgeBasesLoaded) {
            // 返回 Promise 以便外部等待加载完成
            return this._loadSystemKnowledgeBases().catch(error => {
                console.error('加载系统知识库失败:', error);
            });
        }
        
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
        
        // 如果启用 RAG 且是 multi 模式，自动加载系统知识库
        if (value && this._mode === 'multi' && !this._systemKnowledgeBasesLoaded) {
            this.loadAllKnowledgeBases([]);
        }
        
        this._saveState();
    }

    // 获取所有知识库的合并视图
    _getMergedKnowledgeBases() {
        const merged = new Map();
        
        // 先添加系统知识库
        for (const [name, kb] of this.systemKnowledgeBases.entries()) {
            merged.set(name, kb);
        }
        
        // 再添加用户知识库（如有同名会覆盖系统知识库）
        for (const [name, kb] of this.userKnowledgeBases.entries()) {
            merged.set(name, kb);
        }
        
        return merged;
    }

    // 获取知识库（优先返回用户知识库）
    _getKnowledgeBase(name) {
        return this.userKnowledgeBases.get(name) || 
               this.systemKnowledgeBases.get(name);
    }

    // 获取所有知识库列表
    async listKnowledgeBases() {
        try {
            const kbs = Array.from(this._getMergedKnowledgeBases().entries()).map(([name, kb]) => ({
                name,
                path: kb.path,
                active: kb.active || (this.currentKnowledgeBase === name)
            }));
            
            return kbs;
        } catch (error) {
            console.error('获取知识库列表失败:', error);
            throw error;
        }
    }

    // 加载所有知识库
    async loadAllKnowledgeBases(kbs = []) {
        try {
            console.log(`开始加载 ${kbs.length} 个知识库...`);
            
            // 如果是 multi 模式且系统知识库未加载，先加载系统知识库
            if (this.mode === 'multi' && !this._systemKnowledgeBasesLoaded) {
                await this._loadSystemKnowledgeBases();
            }
            
            // 然后加载指定的知识库
            for (const kb of kbs) {
                if (!this._getKnowledgeBase(kb.name)) {
                    console.log(`加载知识库: ${kb.name}`);
                    await this.addKnowledgeBase(kb.path);
                }
            }
            
            return {
                success: true,
                message: `成功加载 ${this._getMergedKnowledgeBases().size} 个知识库`
            };
        } catch (error) {
            console.error('加载知识库失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 获取 RAG 服务状态
    async getStatus() {
        const kbs = Array.from(this._getMergedKnowledgeBases().entries());
        const docCount = kbs.reduce((total, [_, kb]) => {
            return total + (kb?.store?.memoryVectors?.length || 0);
        }, 0);

        // 如果当前知识库不存在于已加载的知识库中，重置它
        if (this.currentKnowledgeBase && !this._getKnowledgeBase(this.currentKnowledgeBase)) {
            this.currentKnowledgeBase = null;
        }

        return {
            isInitialized: kbs.length > 0,
            currentKnowledgeBase: this.currentKnowledgeBase || '无',
            documentCount: docCount,
            chunkSize: this.config.chunkSize,
            chunkOverlap: this.config.chunkOverlap,
            mode: this.mode,
            enabled: this.enabled
        };
    }

    // 获取知识库状态
    async getKnowledgeBaseStatus() {
        const allKbs = Array.from(this._getMergedKnowledgeBases().keys());
        
        // 如果当前知识库不存在于已加载的知识库中，重置它
        if (this.currentKnowledgeBase && !this._getKnowledgeBase(this.currentKnowledgeBase)) {
            this.currentKnowledgeBase = null;
        }
        
        const status = {
            currentKnowledgeBase: this.currentKnowledgeBase || '无',
            loadedKnowledgeBases: allKbs,
            isInitialized: allKbs.length > 0,
            mode: this.mode,
            enabled: this.enabled
        };
        return status;
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
            if (!this.currentKnowledgeBase || !this._getKnowledgeBase(this.currentKnowledgeBase)) {
                throw new Error('没有激活的知识库');
            }
            
            const vectorStore = this._getKnowledgeBase(this.currentKnowledgeBase).store;
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
        const activeKbs = Array.from(this._getMergedKnowledgeBases().keys());
        if (!activeKbs.length) {
            throw new Error('没有可用的知识库');
        }

        console.log(`开始并行查询 ${activeKbs.length} 个知识库:`, activeKbs);
        
        // 并行执行查询
        const results = await Promise.all(
            activeKbs.map(async kbName => {
                try {
                    const kb = this._getKnowledgeBase(kbName);
                    if (!kb?.store) {
                        console.error(`知识库 ${kbName} 未找到或未初始化`);
                        return [];
                    }
                    
                    const searchResults = await kb.store.similaritySearchWithScore(
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

    async switchKnowledgeBase(name) {
        try {
            if (!this._getKnowledgeBase(name)) {
                throw new Error(`知识库 "${name}" 不存在`);
            }
            
            // 取消激活当前知识库
            if (this.currentKnowledgeBase) {
                const current = this._getKnowledgeBase(this.currentKnowledgeBase);
                if (current) {
                    current.active = false;
                }
            }
            
            // 激活新知识库
            const kb = this._getKnowledgeBase(name);
            kb.active = true;
            this.currentKnowledgeBase = name;
            
            // 发出知识库切换事件
            eventManager.emit('rag:knowledgeBaseSwitched', {
                name,
                path: kb.path,
                timestamp: new Date()
            });
            
            // 保存状态
            await this._saveState();
            
            return {
                success: true,
                message: `已切换到知识库 "${name}"`
            };
        } catch (error) {
            console.error('切换知识库失败:', error);
            return {
                success: false,
                message: `切换知识库失败: ${error.message}`
            };
        }
    }

    async removeKnowledgeBase(name) {
        try {
            if (!this._getKnowledgeBase(name)) {
                throw new Error(`知识库 "${name}" 不存在`);
            }
            
            // 如果要删除的是当前激活的知识库，先取消激活
            if (this.currentKnowledgeBase === name) {
                this.currentKnowledgeBase = null;
            }
            
            // 删除知识库
            if (this.userKnowledgeBases.has(name)) {
                this.userKnowledgeBases.delete(name);
            } else if (this.systemKnowledgeBases.has(name)) {
                this.systemKnowledgeBases.delete(name);
            }
            
            // 发出知识库删除事件
            eventManager.emit('rag:knowledgeBaseRemoved', {
                name,
                timestamp: new Date()
            });
            
            // 保存状态
            await this._saveState();
            
            return {
                success: true,
                message: `知识库 "${name}" 已删除`
            };
        } catch (error) {
            console.error('删除知识库失败:', error);
            return {
                success: false,
                message: `删除知识库失败: ${error.message}`
            };
        }
    }

    // 知识库管理方法
    async addKnowledgeBase(filePath) {
        try {
            // 验证文件是否存在
            await fs.access(filePath);
            
            // 获取文件名作为知识库名称
            const name = path.basename(filePath, path.extname(filePath));
            
            // 检查知识库是否已存在
            if (this._getKnowledgeBase(name)) {
                throw new Error(`知识库 "${name}" 已存在`);
            }
            
            // 读取文件内容
            const content = await fs.readFile(filePath, 'utf-8');
            
            // 分割文本
            const textSplitter = new RecursiveCharacterTextSplitter({
                chunkSize: this.config.chunkSize,
                chunkOverlap: this.config.chunkOverlap
            });
            
            console.log(`Starting document loading from: ${filePath}`);
            const docs = await textSplitter.createDocuments([content]);
            console.log(`Documents split into ${docs.length} chunks`);
            
            // 创建向量存储
            console.log('Creating vector store...');
            const vectorStore = await MemoryVectorStore.fromDocuments(
                docs,
                this.embeddings
            );
            console.log('Vector store created successfully');
            
            // 保存向量存储和文件路径
            this.userKnowledgeBases.set(name, {
                store: vectorStore,
                path: filePath,
                active: false
            });
            
            // 如果是第一个添加的知识库，自动激活它
            if (this._getMergedKnowledgeBases().size === 1) {
                await this.switchKnowledgeBase(name);
            }
            
            // 发出知识库添加事件
            eventManager.emit('rag:knowledgeBaseAdded', {
                name,
                path: filePath,
                chunks: docs.length,
                timestamp: new Date()
            });
            
            // 保存状态
            await this._saveState();
            
            return {
                success: true,
                message: `知识库 "${name}" 添加成功，包含 ${docs.length} 个文档块`,
                name: name
            };
        } catch (error) {
            console.error('添加知识库失败:', error);
            return {
                success: false,
                message: `添加知识库失败: ${error.message}`
            };
        }
    }
}
