import { BaseRepository } from './BaseRepository.js';
import { User } from '../../domain/models/user/User.js';

/**
 * 用户仓储实现
 * @extends {BaseRepository<User>}
 */
export class UserRepository extends BaseRepository {
    /**
     * @param {any} database 数据库连接
     */
    constructor(database) {
        super('users', database);
    }

    /**
     * 根据用户名查找用户
     * @param {string} username 用户名
     * @returns {Promise<User|null>}
     */
    async findByUsername(username) {
        const users = await this.findAll({ username });
        return users.length > 0 ? users[0] : null;
    }

    /**
     * 根据邮箱查找用户
     * @param {string} email 邮箱
     * @returns {Promise<User|null>}
     */
    async findByEmail(email) {
        const users = await this.findAll({ email });
        return users.length > 0 ? users[0] : null;
    }

    /**
     * 获取活跃用户
     * @param {number} days 天数
     * @returns {Promise<User[]>}
     */
    async getActiveUsers(days = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        return this.findAll(entity => 
            entity.metadata.lastActivityAt >= cutoffDate
        );
    }

    /**
     * 更新用户活动时间
     * @param {string} userId 用户ID
     * @returns {Promise<User>}
     */
    async updateLastActivity(userId) {
        return this.update(userId, {
            metadata: {
                lastActivityAt: new Date()
            }
        });
    }

    /**
     * 更新用户偏好设置
     * @param {string} userId 用户ID
     * @param {Object} preferences 偏好设置
     * @returns {Promise<User>}
     */
    async updatePreferences(userId, preferences) {
        const user = await this.findById(userId);
        if (!user) {
            throw new Error(`User with id ${userId} not found`);
        }

        const updatedPreferences = {
            ...user.preferences,
            ...preferences
        };

        return this.update(userId, { preferences: updatedPreferences });
    }

    /**
     * 获取用户统计信息
     * @param {string} userId 用户ID
     * @returns {Promise<Object>}
     */
    async getUserStats(userId) {
        const user = await this.findById(userId);
        if (!user) {
            throw new Error(`User with id ${userId} not found`);
        }

        return {
            conversationCount: user.metadata.conversationCount || 0,
            messageCount: user.metadata.messageCount || 0,
            lastActive: user.metadata.lastActivityAt,
            accountAge: new Date() - user.createdAt,
            preferences: user.preferences
        };
    }

    /**
     * 搜索用户
     * @param {string} query 搜索关键词
     * @returns {Promise<User[]>}
     */
    async searchUsers(query) {
        const lowercaseQuery = query.toLowerCase();
        return this.findAll(entity => 
            entity.username.toLowerCase().includes(lowercaseQuery) ||
            entity.email.toLowerCase().includes(lowercaseQuery) ||
            entity.profile?.name?.toLowerCase().includes(lowercaseQuery)
        );
    }

    /**
     * 获取用户角色列表
     * @param {string} userId 用户ID
     * @returns {Promise<string[]>}
     */
    async getUserRoles(userId) {
        const user = await this.findById(userId);
        return user ? user.roles || [] : [];
    }

    /**
     * 检查用户是否有特定角色
     * @param {string} userId 用户ID
     * @param {string} role 角色
     * @returns {Promise<boolean>}
     */
    async hasRole(userId, role) {
        const roles = await this.getUserRoles(userId);
        return roles.includes(role);
    }

    /**
     * 添加用户角色
     * @param {string} userId 用户ID
     * @param {string} role 角色
     * @returns {Promise<User>}
     */
    async addRole(userId, role) {
        const user = await this.findById(userId);
        if (!user) {
            throw new Error(`User with id ${userId} not found`);
        }

        if (!user.roles.includes(role)) {
            user.roles.push(role);
            return this.update(userId, { roles: user.roles });
        }

        return user;
    }

    /**
     * 移除用户角色
     * @param {string} userId 用户ID
     * @param {string} role 角色
     * @returns {Promise<User>}
     */
    async removeRole(userId, role) {
        const user = await this.findById(userId);
        if (!user) {
            throw new Error(`User with id ${userId} not found`);
        }

        const roleIndex = user.roles.indexOf(role);
        if (roleIndex > -1) {
            user.roles.splice(roleIndex, 1);
            return this.update(userId, { roles: user.roles });
        }

        return user;
    }
}
