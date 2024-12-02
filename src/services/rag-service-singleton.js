import { RAGService } from './rag-service.js';

// 创建单例
const ragService = new RAGService({
    chunkSize: 1000,
    chunkOverlap: 200,
    maxRetrievedDocs: 2,
    minRelevanceScore: 0.7,
    debug: true
});

export default ragService;
