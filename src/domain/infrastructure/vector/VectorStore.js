import { Configuration } from '../../../config/Configuration.js';

/**
 * 向量存储接口
 */
export class IVectorStore {
    async initialize() {
        throw new Error('Method not implemented');
    }

    async addDocument(document, metadata = {}) {
        throw new Error('Method not implemented');
    }

    async addDocuments(documents, metadataList = []) {
        throw new Error('Method not implemented');
    }

    async search(query, options = {}) {
        throw new Error('Method not implemented');
    }

    async delete(filter = {}) {
        throw new Error('Method not implemented');
    }

    async clear() {
        throw new Error('Method not implemented');
    }
}

/**
 * 内存向量存储实现
 */
export class MemoryVectorStore extends IVectorStore {
    constructor() {
        super();
        this.documents = [];
        this.config = new Configuration();
    }

    async initialize() {
        // 内存存储不需要特殊初始化
        return true;
    }

    async addDocument(document, metadata = {}) {
        const id = this.documents.length + 1;
        this.documents.push({
            id,
            content: document,
            metadata,
            vector: await this._computeEmbedding(document)
        });
        return id;
    }

    async addDocuments(documents, metadataList = []) {
        const results = [];
        for (let i = 0; i < documents.length; i++) {
            const id = await this.addDocument(
                documents[i],
                metadataList[i] || {}
            );
            results.push(id);
        }
        return results;
    }

    async search(query, options = {}) {
        const {
            limit = 5,
            minScore = 0.7,
            filter = {}
        } = options;

        const queryVector = await this._computeEmbedding(query);
        
        // 计算相似度并过滤
        const results = this.documents
            .filter(doc => this._matchesFilter(doc, filter))
            .map(doc => ({
                id: doc.id,
                content: doc.content,
                metadata: doc.metadata,
                score: this._computeCosineSimilarity(queryVector, doc.vector)
            }))
            .filter(result => result.score >= minScore)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        return results;
    }

    async delete(filter = {}) {
        const initialLength = this.documents.length;
        this.documents = this.documents.filter(
            doc => !this._matchesFilter(doc, filter)
        );
        return initialLength - this.documents.length;
    }

    async clear() {
        const count = this.documents.length;
        this.documents = [];
        return count;
    }

    /**
     * 计算文本的嵌入向量
     * @private
     */
    async _computeEmbedding(text) {
        // TODO: 实现实际的嵌入计算
        // 这里使用简单的模拟实现
        return text.split('')
            .map(char => char.charCodeAt(0))
            .slice(0, 10)
            .map(code => code / 255);
    }

    /**
     * 计算余弦相似度
     * @private
     */
    _computeCosineSimilarity(vec1, vec2) {
        const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
        const norm1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
        const norm2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
        return dotProduct / (norm1 * norm2);
    }

    /**
     * 检查文档是否匹配过滤条件
     * @private
     */
    _matchesFilter(doc, filter) {
        return Object.entries(filter).every(([key, value]) => {
            if (key in doc.metadata) {
                return doc.metadata[key] === value;
            }
            return true;
        });
    }
}

// 导出默认的向量存储实现
export const VectorStore = MemoryVectorStore;
