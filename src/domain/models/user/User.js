const { Entity } = require('../base/Entity.js');
const { ValueObject } = require('../base/ValueObject.js');
const { IdGenerator } = require('../../utils/idGenerator.js');

/**
 * 用户状态枚举
 */
const UserStatus = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    SUSPENDED: 'suspended',
    DELETED: 'deleted'
};

/**
 * 用户偏好设置值对象
 */
class UserPreferences extends ValueObject {
    constructor({
        defaultModel = 'gpt-3.5-turbo',
        ragEnabled = false,
        debugMode = false,
        theme = 'light',
        language = 'zh-CN',
        notifications = {
            email: true,
            desktop: true
        }
    } = {}) {
        super();
        this.defaultModel = defaultModel;
        this.ragEnabled = ragEnabled;
        this.debugMode = debugMode;
        this.theme = theme;
        this.language = language;
        this.notifications = notifications;
    }

    enableRag() {
        this.ragEnabled = true;
    }

    disableRag() {
        this.ragEnabled = false;
    }

    toggleDebugMode() {
        this.debugMode = !this.debugMode;
    }

    updateNotifications(settings) {
        this.notifications = {
            ...this.notifications,
            ...settings
        };
    }
}

/**
 * 用户领域模型
 */
class User extends Entity {
    /**
     * 创建用户实例
     * @param {Object} params 用户参数
     * @param {string} params.id 用户ID
     * @param {string} params.name 用户名称
     * @param {string} [params.email] 用户邮箱
     * @param {UserPreferences} [params.preferences] 用户偏好设置
     * @param {Array} [params.conversations] 会话列表
     * @param {UserStatus} [params.status] 用户状态
     * @param {Date} [params.lastLoginAt] 最后登录时间
     */
    constructor({
        id = IdGenerator.generateUserId(),
        name,
        email,
        preferences = new UserPreferences(),
        conversations = [],
        status = UserStatus.ACTIVE,
        lastLoginAt = new Date()
    }) {
        super(id);
        this.name = name;
        this.email = email;
        this.preferences = preferences;
        this.conversations = conversations;
        this.status = status;
        this.lastLoginAt = lastLoginAt;
    }

    /**
     * 更新用户偏好设置
     * @param {Object} preferences 新的偏好设置
     */
    updatePreferences(preferences) {
        this.preferences = new UserPreferences({
            ...this.preferences,
            ...preferences
        });
    }

    /**
     * 添加会话
     * @param {Conversation} conversation 会话对象
     */
    addConversation(conversation) {
        this.conversations.push(conversation);
    }

    /**
     * 移除会话
     * @param {string} conversationId 会话ID
     */
    removeConversation(conversationId) {
        this.conversations = this.conversations.filter(
            conv => conv.id !== conversationId
        );
    }

    /**
     * 更新用户状态
     * @param {UserStatus} status 新状态
     */
    updateStatus(status) {
        if (!Object.values(UserStatus).includes(status)) {
            throw new Error('Invalid user status');
        }
        this.status = status;
    }

    /**
     * 更新最后登录时间
     */
    updateLastLoginTime() {
        this.lastLoginAt = new Date();
    }

    /**
     * 检查用户是否活跃
     * @returns {boolean}
     */
    isActive() {
        return this.status === UserStatus.ACTIVE;
    }

    /**
     * 获取用户会话数量
     * @returns {number}
     */
    getConversationCount() {
        return this.conversations.length;
    }
}

module.exports = {
    User,
    UserPreferences,
    UserStatus
};
