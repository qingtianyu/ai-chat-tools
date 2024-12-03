import { HNSWLib } from '@langchain/community/vectorstores/hnswlib';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from '@langchain/core/documents';
import CONFIG from '../../config/index.js';

class RagService {
    static #instance = null;
    #vectorStore = null;
    #embeddings = null;

    constructor() {
        if (RagService.#instance) {
            return RagService.#instance;
        }
        RagService.#instance = this;
    }

    static getInstance() {
        if (!RagService.#instance) {
            RagService.#instance = new RagService();
        }
        return RagService.#instance;
    }

    async init() {
        // 初始化 embeddings
        this.#embeddings = new OpenAIEmbeddings({
            openAIApiKey: CONFIG.OPENAI.API_KEY,
            modelName: CONFIG.OPENAI.EMBEDDING_MODEL || 'text-embedding-3-small'
        });

        // 初始化向量存储
        this.#vectorStore = await HNSWLib.fromDocuments(
            [], // 初始为空文档列表
            this.#embeddings
        );
    }

    async addDocument(content, metadata = {}) {
        if (!this.#vectorStore) {
            throw new Error('Vector store not initialized. Call init() first.');
        }

        const doc = new Document({
            pageContent: content,
            metadata: metadata
        });

        await this.#vectorStore.addDocuments([doc]);
    }

    async similaritySearch(query, k = 3) {
        if (!this.#vectorStore) {
            throw new Error('Vector store not initialized. Call init() first.');
        }

        return await this.#vectorStore.similaritySearch(query, k);
    }

    async clear() {
        if (this.#vectorStore) {
            // HNSWLib 没有直接的清除方法，所以我们重新初始化
            await this.init();
        }
    }
}

export default RagService;
