import { ChatOpenAI } from '@langchain/openai';
import { OpenAIEmbeddings } from '@langchain/openai';
import CONFIG from '../config/index.js';

export class OpenAIClient {
    static #instance = null;

    constructor() {
        if (OpenAIClient.#instance) {
            return OpenAIClient.#instance;
        }

        if (!CONFIG.openai?.apiKey) {
            throw new Error('OpenAI API key is required');
        }

        this.config = CONFIG.openai;
        this._initClients();
        OpenAIClient.#instance = this;
    }

    static getInstance() {
        if (!OpenAIClient.#instance) {
            OpenAIClient.#instance = new OpenAIClient();
        }
        return OpenAIClient.#instance;
    }

    _initClients() {
        const baseConfig = {
            openAIApiKey: this.config.apiKey,
            configuration: {
                basePath: this.config.apiBase,
                baseURL: this.config.apiBase,
                defaultHeaders: {
                    'Content-Type': 'application/json'
                }
            }
        };

        // 初始化聊天客户端
        this.chatClient = new ChatOpenAI({
            ...baseConfig,
            modelName: this.config.modelName,
            temperature: this.config.temperature.chat
        });

        // 初始化工具客户端
        this.toolsClient = new ChatOpenAI({
            ...baseConfig,
            modelName: this.config.modelName,
            temperature: this.config.temperature.tools
        });

        // 初始化 embeddings 客户端
        this.embeddingsClient = new OpenAIEmbeddings({
            ...baseConfig,
            modelName: this.config.embeddingsModel,
            batchSize: this.config.embeddingsBatchSize || 512
        });
    }

    async chatCompletion(messages) {
        try {
            const response = await this.chatClient.invoke(messages);
            return response.content;
        } catch (error) {
            console.error('Error in chat completion:', error);
            throw error;
        }
    }

    async toolsCompletion(messages) {
        try {
            const response = await this.toolsClient.invoke(messages);
            return response.content;
        } catch (error) {
            console.error('Error in tools completion:', error);
            throw error;
        }
    }

    async embedDocuments(documents) {
        try {
            return await this.embeddingsClient.embedDocuments(documents);
        } catch (error) {
            console.error('Error in document embedding:', error);
            throw error;
        }
    }

    async embedQuery(query) {
        try {
            return await this.embeddingsClient.embedQuery(query);
        } catch (error) {
            console.error('Error in query embedding:', error);
            throw error;
        }
    }
}

export default OpenAIClient;
