import { IKnowledgeService } from './IKnowledgeService.js';
import { Knowledge } from '../../models/knowledge/Knowledge.js';
import { IdGenerator } from '../../../utils/idGenerator.js';

/**
 * 知识库服务实现
 */
export class KnowledgeService extends IKnowledgeService {
    constructor(knowledgeRepository) {
        super();
        this.knowledgeRepository = knowledgeRepository;
    }

    /**
     * 创建知识条目
     * @param {Object} data 知识数据
     * @returns {Promise<Knowledge>}
     */
    async createKnowledge(data) {
        const knowledge = new Knowledge({
            id: IdGenerator.generateId(),
            ...data,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await this.knowledgeRepository.create(knowledge);
        return knowledge;
    }

    /**
     * 获取知识条目
     * @param {string} id 知识ID
     * @returns {Promise<Knowledge|null>}
     */
    async getKnowledge(id) {
        return this.knowledgeRepository.findById(id);
    }

    /**
     * 更新知识条目
     * @param {string} id 知识ID
     * @param {Object} data 更新数据
     * @returns {Promise<Knowledge>}
     */
    async updateKnowledge(id, data) {
        const knowledge = await this.knowledgeRepository.findById(id);
        if (!knowledge) {
            throw new Error(`Knowledge with id ${id} not found`);
        }

        Object.assign(knowledge, {
            ...data,
            updatedAt: new Date()
        });

        await this.knowledgeRepository.update(id, knowledge);
        return knowledge;
    }

    /**
     * 删除知识条目
     * @param {string} id 知识ID
     * @returns {Promise<void>}
     */
    async deleteKnowledge(id) {
        await this.knowledgeRepository.delete(id);
    }

    /**
     * 搜索知识库
     * @param {string} query 搜索关键词
     * @param {Object} options 搜索选项
     * @returns {Promise<Knowledge[]>}
     */
    async searchKnowledge(query, options = {}) {
        return this.knowledgeRepository.search(query, options);
    }

    /**
     * 按类别获取知识条目
     * @param {string} category 类别
     * @returns {Promise<Knowledge[]>}
     */
    async getKnowledgeByCategory(category) {
        return this.knowledgeRepository.findByCategory(category);
    }

    /**
     * 获取所有知识类别
     * @returns {Promise<string[]>}
     */
    async getAllCategories() {
        return this.knowledgeRepository.getAllCategories();
    }
}
