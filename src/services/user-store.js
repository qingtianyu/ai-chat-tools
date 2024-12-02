import { join } from 'path';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';

export class UserStore {
    constructor() {
        this.users = {};
        this.dataPath = join(process.cwd(), 'user-data', 'users.json');
    }

    async initialize() {
        this.ensureDataDirectory();
        await this.loadUsers();
        return true;
    }

    ensureDataDirectory() {
        const dir = join(process.cwd(), 'user-data');
        if (!fsSync.existsSync(dir)) {
            fsSync.mkdirSync(dir, { recursive: true });
        }
    }

    async loadUsers() {
        try {
            if (fsSync.existsSync(this.dataPath)) {
                const data = await fs.readFile(this.dataPath, 'utf8');
                this.users = JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading users:', error);
            this.users = {};
        }
    }

    async saveUsers() {
        try {
            // 确保目录存在
            const dir = join(process.cwd(), 'user-data');
            if (!fsSync.existsSync(dir)) {
                fsSync.mkdirSync(dir, { recursive: true });
            }

            // 保存数据
            await fs.writeFile(
                this.dataPath,
                JSON.stringify(this.users, null, 2),
                'utf8'
            );
            return true;
        } catch (error) {
            console.error('Error saving users:', error);
            throw error;
        }
    }

    async saveUserData(userId, userData) {
        this.users[userId] = userData;
        return await this.saveUsers();
    }

    createUser(userData) {
        if (!userData || !userData.id) {
            throw new Error('User data with ID is required');
        }

        const user = {
            id: userData.id,
            created: new Date().toISOString(),
            profile: {
                name: userData.profile?.name || null,
                age: userData.profile?.age || null,
                interests: userData.profile?.interests || [],
                preferences: userData.profile?.preferences || {},
                habits: userData.profile?.habits || []
            },
            memories: [],
            conversations: [],
            lastActive: new Date().toISOString()
        };

        this.users[userData.id] = user;
        this.saveUsers();
        return user;
    }

    // 获取用户数据
    async getUserData(userId) {
        const user = this.getUser(userId);
        if (!user) {
            throw new Error('User not found');
        }
        return user;
    }

    // 获取用户
    getUser(userId) {
        return this.users[userId];
    }

    async updateUserProfile(userId, profile) {
        const user = await this.getUser(userId);
        if (!user) {
            throw new Error('User not found');
        }

        user.profile = {
            ...user.profile,
            ...profile
        };
        user.lastActive = new Date().toISOString();
        
        await this.saveUsers();
        return user;
    }

    async addMemory(userId, memory) {
        if (!this.users[userId]) {
            throw new Error('User not found');
        }

        const newMemory = {
            id: Date.now().toString(),
            content: memory,
            timestamp: new Date().toISOString(),
            type: 'general'
        };

        this.users[userId].memories.push(newMemory);
        this.users[userId].lastActive = new Date().toISOString();
        await this.saveUsers();
        return newMemory;
    }

    async addConversation(userId, conversation) {
        if (!this.users[userId]) {
            throw new Error('User not found');
        }

        const newConversation = {
            id: Date.now().toString(),
            summary: conversation.summary || '',
            timestamp: new Date().toISOString(),
            messages: conversation.messages || []
        };

        this.users[userId].conversations.push(newConversation);
        this.users[userId].lastActive = new Date().toISOString();
        await this.saveUsers();
        return newConversation;
    }

    async searchMemories(userId, query, limit = 3) {
        if (!this.users[userId]) {
            throw new Error('User not found');
        }

        // 简单的关键词匹配搜索
        const memories = this.users[userId].memories
            .filter(memory => 
                memory.content.toLowerCase().includes(query.toLowerCase())
            )
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);

        return memories;
    }

    async getRecentConversations(userId, limit = 5) {
        if (!this.users[userId]) {
            throw new Error('User not found');
        }

        return this.users[userId].conversations
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }

    async generateUserId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        return `user_${random}_${timestamp.toString(36)}`;
    }

    async saveUser(userId, userData) {
        if (!userId) {
            console.error('Invalid user ID provided to saveUser:', userId);
            return false;
        }

        try {
            // 如果是新用户，初始化基本数据
            if (!this.users[userId]) {
                this.users[userId] = {
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
            }

            // 更新用户数据
            this.users[userId] = {
                ...this.users[userId],
                ...userData,
                lastActive: new Date().toISOString()
            };

            // 保存到文件
            await this.saveUsers();
            return true;
        } catch (error) {
            console.error('Error saving user:', error);
            return false;
        }
    }

    // 确保用户存在，如果不存在则创建
    async ensureUser(userId) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        let user = await this.getUser(userId);
        if (!user) {
            user = this.createUser({ id: userId });
            await this.saveUser(userId, user);
        }
        return user;
    }

    // 生成唯一的用户ID
    generateUserId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        return `user_${random}_${timestamp.toString(36)}`;
    }
}
