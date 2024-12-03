import userStore from '../../services/user-store-singleton.js';
import { ChatError, ErrorCodes } from '../../utils/ErrorHandler.js';

class UserService {
    static #instance = null;

    constructor() {
        if (UserService.#instance) {
            return UserService.#instance;
        }
        UserService.#instance = this;
    }

    static getInstance() {
        if (!UserService.#instance) {
            UserService.#instance = new UserService();
        }
        return UserService.#instance;
    }

    async getUser(userId) {
        try {
            const userData = await userStore.getUserData(userId);
            if (!userData) {
                return null;
            }
            return userData;
        } catch (error) {
            throw new ChatError(
                '获取用户数据失败',
                ErrorCodes.USER_NOT_FOUND,
                { userId }
            );
        }
    }

    async createUser(userId) {
        try {
            const newUser = {
                id: userId,
                created: new Date().toISOString(),
                profile: {
                    name: null,
                    age: null,
                    interests: [],
                    preferences: {},
                    habits: []
                },
                memories: [],
                conversations: [],
                lastActive: new Date().toISOString()
            };
            await userStore.saveUserData(userId, newUser);
            return newUser;
        } catch (error) {
            throw new ChatError(
                '创建用户失败',
                ErrorCodes.INTERNAL_ERROR,
                { userId }
            );
        }
    }

    async saveUser(user) {
        try {
            user.lastActive = new Date().toISOString();
            await userStore.saveUserData(user.id, user);
        } catch (error) {
            throw new ChatError(
                '保存用户数据失败',
                ErrorCodes.INTERNAL_ERROR,
                { userId: user.id }
            );
        }
    }

    async getOrCreateUser(userId) {
        let user = await this.getUser(userId);
        if (!user) {
            user = await this.createUser(userId);
        }
        return user;
    }
}

export default UserService;
