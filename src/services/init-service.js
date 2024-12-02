import fs from 'fs/promises';
import { join } from 'path';
import { DatabaseService } from './database.js';
import { VectorStoreService } from './vector-store.js';
import userStore from './user-store-singleton.js';

export class InitService {
    constructor() {
        this.db = new DatabaseService();
        this.vectorStore = new VectorStoreService();
        this.userStore = userStore;
    }

    async initialize() {
        console.log('🚀 开始系统初始化...');
        
        try {
            // 1. 清理数据目录
            console.log('🗑️  清理数据目录...');
            await this.clearDirectory(join(process.cwd(), 'memory-data'));
            await this.clearDirectory(join(process.cwd(), 'data'));
            await this.clearDirectory(join(process.cwd(), 'user-data'));
            
            // 2. 删除用户ID文件
            console.log('🗑️  清理用户数据...');
            try {
                await fs.unlink('.user-id');
            } catch (error) {
                // 文件可能不存在，忽略错误
            }

            // 3. 清理数据库
            console.log('🗑️  清理数据库...');
            await this.clearDatabase();

            // 4. 重新初始化需要初始化的服务
            console.log('🔄 重新初始化服务...');
            await Promise.all([
                this.vectorStore.initialize(),
                // UserStore 现在在构造函数中自动初始化
                Promise.resolve()
            ]);

            console.log('✨ 系统初始化完成！环境已清理干净。');
            return true;
        } catch (error) {
            console.error('❌ 系统初始化失败:', error);
            throw error;
        }
    }

    async clearDatabase() {
        try {
            // 清理所有消息
            await this.db.prisma.message.deleteMany();
            console.log('📂 已清理所有消息');

            // 清理所有对话
            await this.db.prisma.conversation.deleteMany();
            console.log('📂 已清理所有对话');

            // 如果还有其他表，在这里添加清理代码
        } catch (error) {
            console.error('清理数据库失败:', error);
            throw error;
        }
    }

    async clearDirectory(dirPath) {
        try {
            // 确保目录存在
            await fs.mkdir(dirPath, { recursive: true });
            
            // 读取目录内容
            const files = await fs.readdir(dirPath);
            
            // 删除所有文件
            await Promise.all(
                files.map(file => 
                    fs.unlink(join(dirPath, file))
                        .catch(error => console.warn(`警告: 无法删除文件 ${file}:`, error))
                )
            );
            
            console.log(`📂 目录已清理: ${dirPath}`);
        } catch (error) {
            if (error.code !== 'ENOENT') { // 忽略目录不存在的错误
                throw error;
            }
        }
    }
}
