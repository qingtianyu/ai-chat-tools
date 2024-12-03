const { IUserService } = require('./IUserService.js');
const { User, UserPreferences } = require('../../models/user/User.js');
const { IdGenerator } = require('../../utils/idGenerator.js');

/**
 * 用户服务实现
 */
class UserService extends IUserService {
    constructor(userRepository, eventEmitter) {
        super();
        this.userRepository = userRepository;
        this.eventEmitter = eventEmitter;
    }

    async createUser(userData) {
        const userId = IdGenerator.generateUserId();
        const preferences = new UserPreferences(userData.preferences);
        
        const user = new User({
            id: userId,
            name: userData.name,
            preferences
        });

        await this.userRepository.create(user);
        this.eventEmitter.emit('user:created', user);
        
        return user;
    }

    async updateUserPreferences(userId, preferences) {
        const user = await this.getUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        user.updatePreferences(preferences);
        await this.userRepository.update(userId, user);
        this.eventEmitter.emit('user:preferences:updated', { userId, preferences });
    }

    async getUserConversations(userId) {
        const user = await this.getUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        return user.conversations;
    }

    async deleteUser(userId) {
        const user = await this.getUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        await this.userRepository.delete(userId);
        this.eventEmitter.emit('user:deleted', userId);
    }

    async getUserById(userId) {
        return this.userRepository.findById(userId);
    }

    async authenticateUser(username, password) {
        // 实现用户认证逻辑
        const user = await this.userRepository.findByUsername(username);
        if (!user) {
            throw new Error('User not found');
        }
        // TODO: 实现密码验证
        return user;
    }
}

module.exports = { UserService };
