import { OpenAIEmbeddings } from './OpenAIEmbeddings.js';

/**
 * 向量存储实现
 */
export class VectorStore {
    constructor(database, embeddings = new OpenAIEmbeddings()) {
        this.database = database;
        this.embeddings = embeddings;
        this.collection = 'vectors';
    }

    /**
     * 添加文档到向量存储
     * @param {string} knowledgeBaseId 知识库ID
     * @param {Array} chunks 文档块数组
     */
    async addDocuments(knowledgeBaseId, chunks) {
        const vectors = await Promise.all(
            chunks.map(async chunk => {
                const embedding = await this.embeddings.embed(chunk.content);
                return {
                    knowledgeBaseId,
                    chunkId: chunk.id,
                    content: chunk.content,
                    embedding,
                    metadata: chunk.metadata,
                    createdAt: new Date()
                };
            })
        );

        await this.database.bulkInsert(this.collection, vectors);
    }

    /**
     * 搜索相似文档
     * @param {string} query 查询文本
     * @param {Object} options 搜索选项
     * @returns {Promise<Array>} 搜索结果
     */
    async search(query, options = {}) {
        const {
            limit = 5,
            minScore = 0.7,
            knowledgeBaseId = null
        } = options;

        // 获取查询文本的向量表示
        const queryEmbedding = await this.embeddings.embed(query);

        // 构建搜索条件
        const searchQuery = {
            embedding: {
                $cosineDistance: queryEmbedding,
                $minScore: minScore
            }
        };

        if (knowledgeBaseId) {
            searchQuery.knowledgeBaseId = knowledgeBaseId;
        }

        // 执行向量相似度搜索
        const results = await this.database.vectorSearch(
            this.collection,
            searchQuery,
            { limit }
        );

        return results.map(result => ({
            knowledgeBaseId: result.knowledgeBaseId,
            chunkId: result.chunkId,
            content: result.content,
            score: result.score,
            metadata: result.metadata
        }));
    }

    /**
     * 删除知识库相关的所有向量
     * @param {string} knowledgeBaseId 知识库ID
     */
    async deleteByKnowledgeBaseId(knowledgeBaseId) {
        await this.database.delete(this.collection, { knowledgeBaseId });
    }

    /**
     * 删除特定文档块的向量
     * @param {string} chunkId 文档块ID
     */
    async deleteByChunkId(chunkId) {
        await this.database.delete(this.collection, { chunkId });
    }

    /**
     * 更新文档块的向量
     * @param {string} chunkId 文档块ID
     * @param {string} content 新的文本内容
     */
    async updateChunkVector(chunkId, content) {
        const embedding = await this.embeddings.embed(content);
        await this.database.update(
            this.collection,
            { chunkId },
            {
                content,
                embedding,
                updatedAt: new Date()
            }
        );
    }

    /**
     * 批量更新向量
     * @param {Array} updates 更新数组
     */
    async bulkUpdateVectors(updates) {
        const operations = await Promise.all(
            updates.map(async ({ chunkId, content }) => {
                const embedding = await this.embeddings.embed(content);
                return {
                    filter: { chunkId },
                    update: {
                        content,
                        embedding,
                        updatedAt: new Date()
                    }
                };
            })
        );

        await this.database.bulkUpdate(this.collection, operations);
    }
}
