import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

class VectorStoreManager {
    constructor() {
        this.vectorStore = null;
        this.embeddings = new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY,
            configuration: {
                baseURL: process.env.OPENAI_BASE_URL,
                timeout: 30000 // 增加超时时间到30秒
            }
        });
        this.textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
    }

    // 从文本创建向量存储
    async createFromText(text) {
        try {
            console.log('开始分割文本...');
            // 将文本分割成小块
            const splitDocs = await this.textSplitter.createDocuments([text]);
            console.log(`文本已分割成 ${splitDocs.length} 个片段`);
            
            console.log('开始创建向量存储...');
            // 创建向量存储
            this.vectorStore = await MemoryVectorStore.fromDocuments(
                splitDocs,
                this.embeddings
            );
            console.log('向量存储创建完成');
            
            return true;
        } catch (error) {
            console.error('创建向量存储失败:', error.message);
            if (error.cause) {
                console.error('错误原因:', error.cause.message);
            }
            return false;
        }
    }

    // 相似度搜索
    async similaritySearch(query, k = 3) {
        if (!this.vectorStore) {
            console.log('没有可用的向量存储');
            return [];
        }

        try {
            console.log('开始向量搜索...');
            const results = await this.vectorStore.similaritySearchWithScore(query, k);
            
            // 将结果转换为百分比分数并过滤
            const filteredResults = results
                .map(([doc, score]) => ({
                    pageContent: doc.pageContent,
                    metadata: doc.metadata,
                    score: Math.round((1 - score) * 100) // 转换为百分比相似度
                }))
                .filter(item => item.score > 20) // 只保留相关度大于20%的结果
                .sort((a, b) => b.score - a.score); // 按相关度降序排序

            console.log(`找到 ${filteredResults.length} 个相关结果`);
            return filteredResults;
        } catch (error) {
            console.error('向量搜索失败:', error.message);
            if (error.cause) {
                console.error('错误原因:', error.cause.message);
            }
            return [];
        }
    }

    // 清除向量存储
    clear() {
        this.vectorStore = null;
    }

    // 检查是否有向量存储
    hasVectorStore() {
        return this.vectorStore !== null;
    }
}

export default VectorStoreManager;
