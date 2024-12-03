/**
 * 通用仓储接口
 * @template T
 */
export class IRepository {
    /**
     * 创建实体
     * @param {T} entity 实体对象
     * @returns {Promise<T>}
     */
    async create(entity) {
        throw new Error('Not implemented');
    }

    /**
     * 根据ID查找实体
     * @param {string} id 实体ID
     * @returns {Promise<T|null>}
     */
    async findById(id) {
        throw new Error('Not implemented');
    }

    /**
     * 查找所有实体
     * @param {Object} filter 过滤条件
     * @returns {Promise<T[]>}
     */
    async findAll(filter = {}) {
        throw new Error('Not implemented');
    }

    /**
     * 更新实体
     * @param {string} id 实体ID
     * @param {Partial<T>} entity 部分实体数据
     * @returns {Promise<T>}
     */
    async update(id, entity) {
        throw new Error('Not implemented');
    }

    /**
     * 删除实体
     * @param {string} id 实体ID
     * @returns {Promise<void>}
     */
    async delete(id) {
        throw new Error('Not implemented');
    }

    /**
     * 批量创建实体
     * @param {T[]} entities 实体对象数组
     * @returns {Promise<T[]>}
     */
    async bulkCreate(entities) {
        throw new Error('Not implemented');
    }

    /**
     * 批量更新实体
     * @param {Array<{id: string, entity: Partial<T>}>} updates 更新数据数组
     * @returns {Promise<T[]>}
     */
    async bulkUpdate(updates) {
        throw new Error('Not implemented');
    }

    /**
     * 批量删除实体
     * @param {string[]} ids 实体ID数组
     * @returns {Promise<void>}
     */
    async bulkDelete(ids) {
        throw new Error('Not implemented');
    }

    /**
     * 统计实体数量
     * @param {Object} filter 过滤条件
     * @returns {Promise<number>}
     */
    async count(filter = {}) {
        throw new Error('Not implemented');
    }
}
