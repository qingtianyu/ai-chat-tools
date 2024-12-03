import { BaseRepository } from './BaseRepository.js';
import { Conversation, ConversationMetadata } from '../../domain/models/conversation/Conversation.js';

/**
 * 会话仓储实现
 */
export class ConversationRepository extends BaseRepository {
    constructor(database) {
        super(database, 'conversations');
    }

    /**
     * 根据ID查找会话
     * @param {string} id 会话ID
     * @returns {Promise<Conversation|null>}
     */
    async findById(id) {
        const data = await this.database.findOne(this.collection, { id });
        if (!data) return null;
        return this._toEntity(data);
    }

    /**
     * 根据用户ID查找会话列表
     * @param {string} userId 用户ID
     * @returns {Promise<Conversation[]>}
     */
    async findByUserId(userId) {
        const data = await this.database.find(this.collection, { userId });
        return data.map(item => this._toEntity(item));
    }

    /**
     * 创建会话
     * @param {Conversation} conversation 会话实体
     * @returns {Promise<void>}
     */
    async create(conversation) {
        await this.database.insert(this.collection, this._toData(conversation));
    }

    /**
     * 更新会话
     * @param {string} id 会话ID
     * @param {Conversation} conversation 会话实体
     * @returns {Promise<void>}
     */
    async update(id, conversation) {
        await this.database.update(
            this.collection,
            { id },
            this._toData(conversation)
        );
    }

    /**
     * 删除会话
     * @param {string} id 会话ID
     * @returns {Promise<void>}
     */
    async delete(id) {
        await this.database.delete(this.collection, { id });
    }

    /**
     * 将数据转换为实体
     * @private
     */
    _toEntity(data) {
        return new Conversation({
            id: data.id,
            userId: data.userId,
            title: data.title,
            messages: data.messages,
            status: data.status,
            metadata: new ConversationMetadata(data.metadata),
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt)
        });
    }

    /**
     * 将实体转换为数据
     * @private
     */
    _toData(conversation) {
        return {
            id: conversation.id,
            userId: conversation.userId,
            title: conversation.title,
            messages: conversation.messages,
            status: conversation.status,
            metadata: conversation.metadata,
            createdAt: conversation.createdAt.toISOString(),
            updatedAt: conversation.updatedAt.toISOString()
        };
    }
}
