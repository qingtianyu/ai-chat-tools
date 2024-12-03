import { IRepository } from '../../domain/repositories/IRepository.js';
import { Entity } from '../../domain/models/base/Entity.js';

/**
 * 基础仓储实现
 * @template T
 * @extends {IRepository<T>}
 */
export class BaseRepository extends IRepository {
    /**
     * @param {string} entityName 实体名称
     * @param {any} database 数据库连接
     */
    constructor(entityName, database) {
        super();
        this.entityName = entityName;
        this.database = database;
        this.collection = new Map();
    }

    /**
     * 创建实体
     * @param {T} entity 实体对象
     * @returns {Promise<T>}
     */
    async create(entity) {
        if (!(entity instanceof Entity)) {
            throw new Error('Entity must be an instance of Entity class');
        }

        if (this.collection.has(entity.id)) {
            throw new Error(`Entity with id ${entity.id} already exists`);
        }

        this.collection.set(entity.id, { ...entity, createdAt: new Date() });
        return entity;
    }

    /**
     * 根据ID查找实体
     * @param {string} id 实体ID
     * @returns {Promise<T|null>}
     */
    async findById(id) {
        return this.collection.get(id) || null;
    }

    /**
     * 查找所有实体
     * @param {Object} filter 过滤条件
     * @returns {Promise<T[]>}
     */
    async findAll(filter = {}) {
        const entities = Array.from(this.collection.values());
        return this._applyFilter(entities, filter);
    }

    /**
     * 更新实体
     * @param {string} id 实体ID
     * @param {Partial<T>} entityData 部分实体数据
     * @returns {Promise<T>}
     */
    async update(id, entityData) {
        const entity = await this.findById(id);
        if (!entity) {
            throw new Error(`Entity with id ${id} not found`);
        }

        const updatedEntity = {
            ...entity,
            ...entityData,
            updatedAt: new Date()
        };

        this.collection.set(id, updatedEntity);
        return updatedEntity;
    }

    /**
     * 删除实体
     * @param {string} id 实体ID
     * @returns {Promise<void>}
     */
    async delete(id) {
        if (!this.collection.has(id)) {
            throw new Error(`Entity with id ${id} not found`);
        }
        this.collection.delete(id);
    }

    /**
     * 批量创建实体
     * @param {T[]} entities 实体对象数组
     * @returns {Promise<T[]>}
     */
    async bulkCreate(entities) {
        const createdEntities = [];
        for (const entity of entities) {
            const created = await this.create(entity);
            createdEntities.push(created);
        }
        return createdEntities;
    }

    /**
     * 批量更新实体
     * @param {Array<{id: string, entity: Partial<T>}>} updates 更新数据数组
     * @returns {Promise<T[]>}
     */
    async bulkUpdate(updates) {
        const updatedEntities = [];
        for (const { id, entity } of updates) {
            const updated = await this.update(id, entity);
            updatedEntities.push(updated);
        }
        return updatedEntities;
    }

    /**
     * 批量删除实体
     * @param {string[]} ids 实体ID数组
     * @returns {Promise<void>}
     */
    async bulkDelete(ids) {
        for (const id of ids) {
            await this.delete(id);
        }
    }

    /**
     * 统计实体数量
     * @param {Object} filter 过滤条件
     * @returns {Promise<number>}
     */
    async count(filter = {}) {
        const entities = await this.findAll(filter);
        return entities.length;
    }

    /**
     * 清空集合
     * @returns {Promise<void>}
     */
    async clear() {
        this.collection.clear();
    }

    /**
     * 应用过滤条件
     * @private
     * @param {T[]} entities 实体数组
     * @param {Object} filter 过滤条件
     * @returns {T[]}
     */
    _applyFilter(entities, filter) {
        return entities.filter(entity => {
            return Object.entries(filter).every(([key, value]) => {
                if (typeof value === 'function') {
                    return value(entity[key]);
                }
                if (value instanceof RegExp) {
                    return value.test(entity[key]);
                }
                if (typeof value === 'object' && value !== null) {
                    return JSON.stringify(entity[key]) === JSON.stringify(value);
                }
                return entity[key] === value;
            });
        });
    }

    /**
     * 事务操作
     * @param {Function} operation 事务操作函数
     * @returns {Promise<any>}
     */
    async transaction(operation) {
        const snapshot = new Map(this.collection);
        try {
            const result = await operation();
            return result;
        } catch (error) {
            this.collection = snapshot;
            throw error;
        }
    }
}
