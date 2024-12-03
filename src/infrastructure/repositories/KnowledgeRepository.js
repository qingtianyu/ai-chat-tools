import { IRepository } from '../../domain/repositories/IRepository.js';
import { KnowledgeBase } from '../../domain/models/knowledge/KnowledgeBase.js';

/**
 * 知识库仓储实现
 */
export class KnowledgeRepository extends IRepository {
    constructor(database) {
        super();
        this.database = database;
        this.collection = 'knowledge_bases';
    }

    async create(knowledgeBase) {
        const result = await this.database.insert(this.collection, {
            ...knowledgeBase,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        return new KnowledgeBase(result);
    }

    async findById(id) {
        const result = await this.database.findOne(this.collection, { id });
        return result ? new KnowledgeBase(result) : null;
    }

    async findByType(type) {
        const results = await this.database.find(this.collection, { type });
        return results.map(result => new KnowledgeBase(result));
    }

    async findAll(filter = {}) {
        const results = await this.database.find(this.collection, filter);
        return results.map(result => new KnowledgeBase(result));
    }

    async update(id, knowledgeBaseData) {
        const result = await this.database.update(
            this.collection,
            { id },
            {
                ...knowledgeBaseData,
                updatedAt: new Date()
            }
        );
        return new KnowledgeBase(result);
    }

    async delete(id) {
        await this.database.delete(this.collection, { id });
    }

    async addChunk(knowledgeBaseId, chunk) {
        const result = await this.database.update(
            this.collection,
            { id: knowledgeBaseId },
            {
                $push: { chunks: chunk },
                updatedAt: new Date()
            }
        );
        return new KnowledgeBase(result);
    }

    async removeChunk(knowledgeBaseId, chunkId) {
        const result = await this.database.update(
            this.collection,
            { id: knowledgeBaseId },
            {
                $pull: { chunks: { id: chunkId } },
                updatedAt: new Date()
            }
        );
        return new KnowledgeBase(result);
    }

    async bulkCreate(knowledgeBases) {
        const timestamp = new Date();
        const knowledgeBasesWithTimestamp = knowledgeBases.map(kb => ({
            ...kb,
            createdAt: timestamp,
            updatedAt: timestamp
        }));
        
        const results = await this.database.bulkInsert(this.collection, knowledgeBasesWithTimestamp);
        return results.map(result => new KnowledgeBase(result));
    }

    async bulkUpdate(updates) {
        const timestamp = new Date();
        const operations = updates.map(({ id, entity }) => ({
            filter: { id },
            update: {
                ...entity,
                updatedAt: timestamp
            }
        }));

        const results = await this.database.bulkUpdate(this.collection, operations);
        return results.map(result => new KnowledgeBase(result));
    }

    async bulkDelete(ids) {
        await this.database.bulkDelete(this.collection, { id: { $in: ids } });
    }

    async count(filter = {}) {
        return await this.database.count(this.collection, filter);
    }
}
