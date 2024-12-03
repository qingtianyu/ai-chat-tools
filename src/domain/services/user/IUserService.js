/**
 * 用户服务接口
 */
export class IUserService {
    /**
     * 创建新用户
     * @param {Object} userData 用户数据
     * @returns {Promise<User>}
     */
    async createUser(userData) {
        throw new Error('Not implemented');
    }

    /**
     * 根据ID获取用户
     * @param {string} userId 用户ID
     * @returns {Promise<User>}
     */
    async getUser(userId) {
        throw new Error('Not implemented');
    }

    /**
     * 更新用户信息
     * @param {string} userId 用户ID
     * @param {Object} userData 用户数据
     * @returns {Promise<void>}
     */
    async updateUser(userId, userData) {
        throw new Error('Not implemented');
    }

    /**
     * 删除用户
     * @param {string} userId 用户ID
     * @returns {Promise<void>}
     */
    async deleteUser(userId) {
        throw new Error('Not implemented');
    }

    /**
     * 获取用户偏好设置
     * @param {string} userId 用户ID
     * @returns {Promise<UserPreferences>}
     */
    async getUserPreferences(userId) {
        throw new Error('Not implemented');
    }

    /**
     * 更新用户偏好设置
     * @param {string} userId 用户ID
     * @param {UserPreferences} preferences 偏好设置
     * @returns {Promise<void>}
     */
    async updateUserPreferences(userId, preferences) {
        throw new Error('Not implemented');
    }
}
