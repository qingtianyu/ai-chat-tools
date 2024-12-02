import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { JSONLoader, JSONLinesLoader } from "langchain/document_loaders/fs/json";
import { TextLoader } from "langchain/document_loaders/fs/text";
import path from 'path';

class FileLoader {
    constructor() {
        this.documentContent = "";
    }

    // 获取当前加载的文档内容
    getDocumentContent() {
        return this.documentContent || "目前没有加载任何文档。";
    }

    // 清除文档内容
    clearContent() {
        this.documentContent = "";
    }

    // 加载CSV文件
    async loadCSV(filepath) {
        try {
            const loader = new CSVLoader(filepath);
            const docs = await loader.load();
            this.documentContent = docs.map(doc => doc.pageContent).join('\n');
            return true;
        } catch (error) {
            console.error('加载CSV文件失败:', error);
            return false;
        }
    }

    // 加载目录中的所有文档
    async loadDirectory(dirPath) {
        try {
            const loader = new DirectoryLoader(dirPath, {
                ".json": (path) => new JSONLoader(path, "/texts"),
                ".jsonl": (path) => new JSONLinesLoader(path, "/html"),
                ".txt": (path) => new TextLoader(path),
                ".csv": (path) => new CSVLoader(path),
            });
            
            const docs = await loader.load();
            
            // 格式化文档内容，去除重复的文件名前缀
            this.documentContent = docs.map(doc => {
                const content = doc.pageContent.split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0)
                    .join('\n');
                return content;
            }).join('\n\n');
            
            return true;
        } catch (error) {
            console.error('加载目录失败:', error);
            return false;
        }
    }
}

export default FileLoader;
