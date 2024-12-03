import { BaseRepository } from './BaseRepository.js';
import { KnowledgeBase } from '../../domain/models/knowledge/KnowledgeBase.js';

/**
 * 知识库仓储实现
 * @extends {BaseRepository<KnowledgeBase>}
 */
export class KnowledgeBaseRepository extends BaseRepository {
    /**
     * @param {any} database 数据库连接
     */
    constructor(database) {
        super('knowledge_bases', database);
    }

    /**
     * 根据标题搜索知识库
     * @param {string} title 标题关键词
     * @returns {Promise<KnowledgeBase[]>}
     */
    async findByTitle(title) {
        return this.findAll(entity => 
            entity.title.toLowerCase().includes(title.toLowerCase())
        );
    }

    /**
     * 根据标签查找知识库
     * @param {string[]} tags 标签数组
     * @returns {Promise<KnowledgeBase[]>}
     */
    async findByTags(tags) {
        return this.findAll(entity =>
            tags.some(tag => entity.metadata.tags?.includes(tag))
        );
    }

    /**
     * 根据状态查找知识库
     * @param {string} status 状态
     * @returns {Promise<KnowledgeBase[]>}
     */
    async findByStatus(status) {
        return this.findAll({ status });
    }

    /**
     * 获取最近更新的知识库
     * @param {number} limit 限制数量
     * @returns {Promise<KnowledgeBase[]>}
     */
    async getRecentlyUpdated(limit = 10) {
        const all = await this.findAll();
        return all
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, limit);
    }

    /**
     * 添加知识块到知识库
     * @param {string} knowledgeBaseId 知识库ID
     * @param {Object} block 知识块
     * @returns {Promise<KnowledgeBase>}
     */
    async addBlock(knowledgeBaseId, block) {
        const knowledgeBase = await this.findById(knowledgeBaseId);
        if (!knowledgeBase) {
            throw new Error(`KnowledgeBase with id ${knowledgeBaseId} not found`);
        }

        knowledgeBase.blocks.push({
            ...block,
            id: crypto.randomUUID(),
            createdAt: new Date()
        });

        return this.update(knowledgeBaseId, {
            blocks: knowledgeBase.blocks,
            metadata: {
                ...knowledgeBase.metadata,
                blockCount: knowledgeBase.blocks.length,
                lastBlockAddedAt: new Date()
            }
        });
    }

    /**
     * 从知识库中移除知识块
     * @param {string} knowledgeBaseId 知识库ID
     * @param {string} blockId 知识块ID
     * @returns {Promise<KnowledgeBase>}
     */
    async removeBlock(knowledgeBaseId, blockId) {
        const knowledgeBase = await this.findById(knowledgeBaseId);
        if (!knowledgeBase) {
            throw new Error(`KnowledgeBase with id ${knowledgeBaseId} not found`);
        }

        const blockIndex = knowledgeBase.blocks.findIndex(block => block.id === blockId);
        if (blockIndex === -1) {
            throw new Error(`Block with id ${blockId} not found in knowledge base`);
        }

        knowledgeBase.blocks.splice(blockIndex, 1);

        return this.update(knowledgeBaseId, {
            blocks: knowledgeBase.blocks,
            metadata: {
                ...knowledgeBase.metadata,
                blockCount: knowledgeBase.blocks.length,
                lastModifiedAt: new Date()
            }
        });
    }

    /**
     * 更新知识库标签
     * @param {string} knowledgeBaseId 知识库ID
     * @param {string[]} tags 标签数组
     * @returns {Promise<KnowledgeBase>}
     */
    async updateTags(knowledgeBaseId, tags) {
        return this.update(knowledgeBaseId, {
            metadata: {
                tags,
                lastModifiedAt: new Date()
            }
        });
    }

    /**
     * 更新知识库状态
     * @param {string} knowledgeBaseId 知识库ID
     * @param {string} status 新状态
     * @returns {Promise<KnowledgeBase>}
     */
    async updateStatus(knowledgeBaseId, status) {
        return this.update(knowledgeBaseId, {
            status,
            metadata: {
                lastStatusChange: new Date(),
                previousStatus: (await this.findById(knowledgeBaseId))?.status
            }
        });
    }

    /**
     * 获取知识库统计信息
     * @param {string} knowledgeBaseId 知识库ID
     * @returns {Promise<Object>}
     */
    async getStats(knowledgeBaseId) {
        const knowledgeBase = await this.findById(knowledgeBaseId);
        if (!knowledgeBase) {
            throw new Error(`KnowledgeBase with id ${knowledgeBaseId} not found`);
        }

        const blockTypes = knowledgeBase.blocks.reduce((acc, block) => {
            acc[block.type] = (acc[block.type] || 0) + 1;
            return acc;
        }, {});

        return {
            totalBlocks: knowledgeBase.blocks.length,
            blockTypes,
            tags: knowledgeBase.metadata.tags || [],
            status: knowledgeBase.status,
            createdAt: knowledgeBase.createdAt,
            lastModified: knowledgeBase.metadata.lastModifiedAt,
            lastBlockAdded: knowledgeBase.metadata.lastBlockAddedAt
        };
    }

    /**
     * 全文搜索知识库内容
     * @param {string} query 搜索关键词
     * @returns {Promise<Array<{knowledgeBase: KnowledgeBase, blocks: Array<{id: string, content: string}>}>>}
     */
    async searchContent(query) {
        const allKnowledgeBases = await this.findAll();
        const lowercaseQuery = query.toLowerCase();

        return allKnowledgeBases
            .map(kb => ({
                knowledgeBase: kb,
                blocks: kb.blocks.filter(block => 
                    block.content.toLowerCase().includes(lowercaseQuery)
                )
            }))
            .filter(result => result.blocks.length > 0);
    }

    /**
     * 获取相似的知识库
     * @param {string} knowledgeBaseId 知识库ID
     * @returns {Promise<KnowledgeBase[]>}
     */
    async getSimilar(knowledgeBaseId) {
        const knowledgeBase = await this.findById(knowledgeBaseId);
        if (!knowledgeBase) {
            throw new Error(`KnowledgeBase with id ${knowledgeBaseId} not found`);
        }

        const tags = knowledgeBase.metadata.tags || [];
        if (tags.length === 0) return [];

        return (await this.findByTags(tags))
            .filter(kb => kb.id !== knowledgeBaseId)
            .sort((a, b) => {
                const aCommonTags = a.metadata.tags?.filter(tag => tags.includes(tag)).length || 0;
                const bCommonTags = b.metadata.tags?.filter(tag => tags.includes(tag)).length || 0;
                return bCommonTags - aCommonTags;
            });
    }
}
