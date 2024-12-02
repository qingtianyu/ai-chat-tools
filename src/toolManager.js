import FileLoader from './fileLoader.js';
import VectorStoreManager from './vectorStore.js';

class ToolManager {
    constructor() {
        this.fileLoader = new FileLoader();
        this.vectorStore = new VectorStoreManager();
    }

    // 获取文档内容
    getDocumentContent() {
        return this.fileLoader.getDocumentContent();
    }

    // 清除所有内容
    clear() {
        this.fileLoader.clearContent();
        this.vectorStore.clear();
    }

    // 加载CSV文件
    async loadCSV(filepath) {
        const success = await this.fileLoader.loadCSV(filepath);
        if (success) {
            // 自动创建向量存储
            await this.createVectorStore();
        }
        return success;
    }

    // 加载目录
    async loadDirectory(dirPath) {
        const success = await this.fileLoader.loadDirectory(dirPath);
        if (success) {
            // 自动创建向量存储
            await this.createVectorStore();
        }
        return success;
    }

    // 创建向量存储
    async createVectorStore() {
        const content = this.fileLoader.getDocumentContent();
        if (content === "目前没有加载任何文档。") {
            return false;
        }
        console.log('正在创建向量存储...');
        const success = await this.vectorStore.createFromText(content);
        if (success) {
            console.log('向量存储创建成功！');
        } else {
            console.log('向量存储创建失败！');
        }
        return success;
    }

    // 相似度搜索并返回格式化结果
    async searchRelevantContent(query) {
        if (!this.vectorStore.hasVectorStore()) {
            return {
                text: "没有可用的向量存储。",
                references: []
            };
        }

        try {
            const results = await this.vectorStore.similaritySearch(query);
            if (results.length === 0) {
                return {
                    text: "没有找到相关内容。",
                    references: []
                };
            }

            // 格式化主要内容
            let formattedResults = "相关文档内容：\n\n";
            results.forEach((doc, index) => {
                formattedResults += `${doc.pageContent}\n\n`;
            });

            // 格式化引用内容
            const references = results.map((doc, index) => ({
                content: doc.pageContent,
                score: doc.score,
                index: index + 1
            }));

            return {
                text: formattedResults,
                references: references
            };
        } catch (error) {
            console.error('搜索相关内容失败:', error);
            return {
                text: "搜索相关内容时发生错误。",
                references: []
            };
        }
    }
}

export default ToolManager;
