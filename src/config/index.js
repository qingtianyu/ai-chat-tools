import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../..');

// 加载环境变量
dotenv.config({ path: resolve(rootDir, '.env') });

const config = {
    openai: {
        apiKey: process.env.OPENAI_API_KEY,
        modelName: process.env.MODEL_NAME || 'gpt-4o',
        embeddingsModel: process.env.OPENAI_EMBEDDINGS_MODEL || 'text-embedding-3-small',
        embeddingsBatchSize: parseInt(process.env.EMBEDDINGS_BATCH_SIZE || '512'),
        apiBase: process.env.OPENAI_BASE_URL || 'https://closeproxy.unidtai.com/v1',
        temperature: {
            chat: parseFloat(process.env.OPENAI_CHAT_TEMPERATURE) || 0.7,
            tools: parseFloat(process.env.OPENAI_TOOLS_TEMPERATURE) || 0
        }
    },
    rag: {
        chunkSize: parseInt(process.env.RAG_CHUNK_SIZE) || 1000,
        chunkOverlap: parseInt(process.env.RAG_CHUNK_OVERLAP) || 200,
        maxRetrievedDocs: parseInt(process.env.RAG_MAX_DOCS) || 4,
        minRelevanceScore: parseFloat(process.env.RAG_MIN_SCORE) || 0.7
    },
    conversation: {
        maxConversationLength: parseInt(process.env.MAX_CONVERSATION_LENGTH || '100'),
        maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH || '4000'),
        maxMessagesPerUser: parseInt(process.env.MAX_MESSAGES_PER_USER || '50')
    },
    systemPrompts: {
        default: process.env.DEFAULT_SYSTEM_PROMPT || 'You are a helpful AI assistant.'
    }
};

// 验证必要的配置
if (!config.openai.apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
}

export default config;
