import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { join } from 'path';
import fs from 'fs/promises';
import dotenv from 'dotenv';

dotenv.config();

export class VectorStoreService {
    constructor() {
        const configuration = {
            apiKey: process.env.OPENAI_API_KEY,
            basePath: process.env.OPENAI_BASE_URL,
            baseURL: process.env.OPENAI_BASE_URL,
            timeout: 30000,
            dangerouslyAllowBrowser: true
        };
        
        this.embeddings = new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY,
            configuration: configuration
        });
        
        this.vectorStore = null;
        this.storagePath = join(process.cwd(), 'memory-data', 'memories.json');
    }

    async initialize() {
        try {
            // 创建存储目录
            await fs.mkdir(join(process.cwd(), 'memory-data'), { recursive: true });

            // 尝试加载现有数据
            let existingData = [];
            try {
                const data = await fs.readFile(this.storagePath, 'utf8');
                const jsonData = JSON.parse(data);
                
                existingData = jsonData
                    .filter(item => item.text || item.pageContent)
                    .map(item => ({
                        pageContent: item.text || item.pageContent || '',
                        metadata: item.metadata || {}
                    }));
                
                console.log(`Loaded ${existingData.length} memories`);
            } catch (error) {
                console.log("No existing memories found, starting fresh");
            }

            // 初始化向量存储
            if (existingData.length > 0) {
                this.vectorStore = await MemoryVectorStore.fromDocuments(
                    existingData,
                    this.embeddings
                );
            } else {
                this.vectorStore = new MemoryVectorStore(this.embeddings);
            }

            console.log("Successfully initialized MemoryVectorStore");
            return true;
        } catch (error) {
            console.error("Error initializing vector store:", error);
            // 创建空的向量存储
            this.vectorStore = new MemoryVectorStore(this.embeddings);
            return true;
        }
    }

    // 添加新的记忆
    async addMemory(content, metadata = {}) {
        if (!this.vectorStore) {
            this.vectorStore = await MemoryVectorStore.fromTexts(
                [content],
                [metadata],
                this.embeddings
            );
        } else {
            await this.vectorStore.addDocuments([
                { pageContent: content, metadata }
            ]);
        }

        // 保存到文件
        await this.saveToFile();
        return true;
    }

    async saveToFile() {
        try {
            const documents = this.vectorStore.memoryVectors;
            await fs.writeFile(
                this.storagePath,
                JSON.stringify(documents, null, 2),
                'utf8'
            );
            return true;
        } catch (error) {
            console.error('Error saving vector store:', error);
            return false;
        }
    }

    // 搜索相关记忆
    async searchMemories(query, limit = 5) {
        if (!this.vectorStore) {
            await this.initialize();
        }

        try {
            const results = await this.vectorStore.similaritySearch(query, limit);
            return results.map(doc => ({
                content: doc.pageContent,
                metadata: doc.metadata
            }));
        } catch (error) {
            console.error("Error searching memories:", error);
            return [];
        }
    }

    // 搜索相关记忆（带用户ID）
    async searchMemories(userId, query, limit = 5) {
        if (!this.vectorStore) {
            await this.initialize();
        }

        try {
            const results = await this.vectorStore.similaritySearch(query, limit);
            return results.map(doc => ({
                content: doc.pageContent,
                metadata: doc.metadata
            })).filter(doc => doc.metadata.userId === userId);
        } catch (error) {
            console.error("Error searching memories:", error);
            return [];
        }
    }

    // 删除特定会话的记忆
    async deleteConversationMemories(conversationId) {
        if (!this.vectorStore) {
            await this.initialize();
        }

        try {
            // 过滤掉指定会话的记忆
            const memories = this.vectorStore.memoryVectors.filter(
                vector => vector.metadata.conversationId !== conversationId
            );

            // 保存到文件
            await fs.writeFile(
                this.storagePath,
                JSON.stringify(
                    memories.map(m => ({
                        text: m.pageContent,
                        metadata: m.metadata
                    })),
                    null,
                    2
                )
            );

            // 重新初始化向量存储
            await this.initialize();
            
            return true;
        } catch (error) {
            console.error("Error deleting memories:", error);
            return false;
        }
    }

    // 获取记忆统计信息
    async getStats() {
        if (!this.vectorStore) {
            await this.initialize();
        }

        try {
            return {
                totalMemories: this.vectorStore.memoryVectors.length,
                storagePath: this.storagePath
            };
        } catch (error) {
            console.error("Error getting stats:", error);
            return {
                totalMemories: 0,
                storagePath: this.storagePath,
                error: error.message
            };
        }
    }

    // 压缩旧的记忆
    async compressOldMemories(userId, threshold = 30) {
        try {
            // 获取用户的所有记忆
            const memories = await this.searchMemories(userId, "", 1000);
            
            if (memories.length <= threshold) {
                return; // 如果记忆数量未超过阈值，不需要压缩
            }

            // 对记忆进行分组和合并
            const groupedMemories = {};
            for (const memory of memories) {
                const date = new Date(memory.metadata.timestamp).toDateString();
                if (!groupedMemories[date]) {
                    groupedMemories[date] = [];
                }
                groupedMemories[date].push(memory);
            }

            // 为每组生成摘要
            for (const [date, memoryGroup] of Object.entries(groupedMemories)) {
                if (memoryGroup.length > 5) { // 只压缩超过5条的组
                    const summary = await this.generateSummary(memoryGroup);
                    await this.addMemory(summary, {
                        userId,
                        messageType: 'summary',
                        timestamp: new Date().toISOString(),
                        originalCount: memoryGroup.length,
                        summaryDate: date
                    });

                    // 移除原始记忆
                    for (const memory of memoryGroup) {
                        await this.removeMemory(memory.content);
                    }
                }
            }

            // 保存更新后的记忆
            await this.saveToFile();
            
            console.log(`Compressed memories for user ${userId}`);
        } catch (error) {
            console.error('Error compressing memories:', error);
        }
    }

    // 生成记忆摘要
    async generateSummary(memories) {
        const texts = memories.map(m => m.content).join('\n');
        return `Summary of ${memories.length} memories: ${texts.substring(0, 200)}...`;
    }

    // 移除记忆
    async removeMemory(memoryContent) {
        // 在实际实现中，这里应该从向量存储中移除记忆
        console.log(`Removing memory ${memoryContent}`);
    }

    async saveMemories() {
        await this.saveToFile();
    }
}
