import { Entity } from '../base/Entity.js';
import { ValueObject } from '../base/ValueObject.js';
import { IdGenerator } from '../../utils/idGenerator.js';

/**
 * 知识库领域模型
 */
export class KnowledgeBase extends Entity {
    /**
     * 创建知识库实例
     * @param {Object} params 知识库参数
     * @param {string} params.id 知识库ID
     * @param {string} params.name 知识库名称
     * @param {string} params.type 知识库类型
     * @param {Array} [params.chunks] 知识块列表
     * @param {KnowledgeBaseMetadata} [params.metadata] 元数据
     * @param {string} [params.status] 知识库状态
     */
    constructor({
        id = IdGenerator.generateKnowledgeBaseId(),
        name,
        type,
        chunks = [],
        metadata = new KnowledgeBaseMetadata(),
        status = KnowledgeBaseStatus.ACTIVE
    }) {
        super(id);
        this.name = name;
        this.type = type;
        this.chunks = chunks;
        this.metadata = metadata;
        this.status = status;
    }

    /**
     * 添加知识块
     * @param {Object} chunk 知识块
     */
    addChunk(chunk) {
        this.chunks.push(chunk);
        this.metadata.updateChunkCount(this.chunks.length);
        this.metadata.lastUpdatedAt = new Date();
    }

    /**
     * 移除知识块
     * @param {string} chunkId 知识块ID
     */
    removeChunk(chunkId) {
        const initialLength = this.chunks.length;
        this.chunks = this.chunks.filter(c => c.id !== chunkId);
        
        if (this.chunks.length !== initialLength) {
            this.metadata.updateChunkCount(this.chunks.length);
            this.metadata.lastUpdatedAt = new Date();
        }
    }

    /**
     * 更新元数据
     * @param {Object} metadata 新的元数据
     */
    updateMetadata(metadata) {
        this.metadata = new KnowledgeBaseMetadata({
            ...this.metadata,
            ...metadata
        });
    }

    /**
     * 停用知识库
     */
    deactivate() {
        if (this.status === KnowledgeBaseStatus.INACTIVE) {
            throw new Error('Knowledge base is already inactive');
        }
        this.status = KnowledgeBaseStatus.INACTIVE;
    }

    /**
     * 激活知识库
     */
    activate() {
        if (this.status === KnowledgeBaseStatus.ACTIVE) {
            throw new Error('Knowledge base is already active');
        }
        this.status = KnowledgeBaseStatus.ACTIVE;
    }

    /**
     * 检查知识库是否活跃
     * @returns {boolean}
     */
    isActive() {
        return this.status === KnowledgeBaseStatus.ACTIVE;
    }

    /**
     * 获取知识库统计信息
     * @returns {Object}
     */
    getStatistics() {
        return {
            chunkCount: this.chunks.length,
            totalTokens: this.metadata.totalTokens,
            averageChunkSize: this.chunks.length > 0
                ? this.metadata.totalTokens / this.chunks.length
                : 0,
            lastUpdated: this.metadata.lastUpdatedAt,
            status: this.status
        };
    }

    /**
     * 获取知识库摘要
     * @returns {Object}
     */
    getSummary() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            status: this.status,
            chunkCount: this.chunks.length,
            source: {
                url: this.metadata.sourceUrl,
                path: this.metadata.sourcePath,
                type: this.metadata.fileType,
                size: this.metadata.fileSize
            }
        };
    }

    /**
     * 创建新知识库
     * @param {string} name 知识库名称
     * @param {string} type 知识库类型
     * @param {Object} [source] 源信息
     * @returns {KnowledgeBase}
     */
    static createNew(name, type, source = {}) {
        const metadata = new KnowledgeBaseMetadata();
        if (source.url) metadata.sourceUrl = source.url;
        if (source.path) metadata.sourcePath = source.path;
        if (source.type) metadata.fileType = source.type;
        if (source.size) metadata.fileSize = source.size;

        return new KnowledgeBase({
            name,
            type,
            metadata,
            status: KnowledgeBaseStatus.ACTIVE
        });
    }
}

/**
 * 知识库元数据值对象
 */
export class KnowledgeBaseMetadata extends ValueObject {
    /**
     * 创建知识库元数据实例
     * @param {Object} [params] 元数据参数
     * @param {Date} [params.createdAt] 创建时间
     * @param {Date} [params.lastUpdatedAt] 最后更新时间
     * @param {number} [params.chunkCount] 知识块数量
     * @param {number} [params.totalTokens] 总Token数
     * @param {string} [params.sourceUrl] 源URL
     * @param {string} [params.sourcePath] 源路径
     * @param {string} [params.fileType] 文件类型
     * @param {number} [params.fileSize] 文件大小
     */
    constructor({
        createdAt = new Date(),
        lastUpdatedAt = new Date(),
        chunkCount = 0,
        totalTokens = 0,
        sourceUrl = null,
        sourcePath = null,
        fileType = null,
        fileSize = null
    } = {}) {
        super();
        this.createdAt = createdAt;
        this.lastUpdatedAt = lastUpdatedAt;
        this.chunkCount = chunkCount;
        this.totalTokens = totalTokens;
        this.sourceUrl = sourceUrl;
        this.sourcePath = sourcePath;
        this.fileType = fileType;
        this.fileSize = fileSize;
    }

    /**
     * 更新知识块数量
     * @param {number} count 新的数量
     */
    updateChunkCount(count) {
        this.chunkCount = count;
        this.lastUpdatedAt = new Date();
    }

    /**
     * 更新Token数量
     * @param {number} tokens 新的Token数量
     */
    updateTokenCount(tokens) {
        this.totalTokens = tokens;
        this.lastUpdatedAt = new Date();
    }

    /**
     * 设置源信息
     * @param {string} url 源URL
     * @param {string} path 源路径
     */
    setSource(url, path) {
        this.sourceUrl = url;
        this.sourcePath = path;
        this.lastUpdatedAt = new Date();
    }

    /**
     * 设置文件信息
     * @param {string} type 文件类型
     * @param {number} size 文件大小
     */
    setFileInfo(type, size) {
        this.fileType = type;
        this.fileSize = size;
        this.lastUpdatedAt = new Date();
    }
}

/**
 * 知识库状态枚举
 */
export const KnowledgeBaseStatus = {
    ACTIVE: 'active',
    INACTIVE: 'inactive'
};
