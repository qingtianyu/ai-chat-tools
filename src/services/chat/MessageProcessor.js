import AgentProcessor from './processors/AgentProcessor.js';
import RagProcessor from './processors/RagProcessor.js';
import DefaultProcessor from './processors/DefaultProcessor.js';
import RateLimiter from '../../utils/RateLimiter.js';

class MessageProcessor {
    static #instance = null;
    #processorChain;
    #ragProcessor;
    rateLimiter;

    constructor() {
        if (MessageProcessor.#instance) {
            return MessageProcessor.#instance;
        }
        
        // 初始化处理器链
        const agentProcessor = new AgentProcessor();
        this.#ragProcessor = new RagProcessor();
        const defaultProcessor = new DefaultProcessor();

        // 设置处理器顺序
        agentProcessor.setNext(this.#ragProcessor);
        this.#ragProcessor.setNext(defaultProcessor);

        this.#processorChain = agentProcessor;
        this.rateLimiter = new RateLimiter();
        MessageProcessor.#instance = this;
    }

    static getInstance() {
        if (!MessageProcessor.#instance) {
            MessageProcessor.#instance = new MessageProcessor();
        }
        return MessageProcessor.#instance;
    }

    async process(message, context) {
        return await this.rateLimiter.executeWithRetry(async () => {
            try {
                return await this.#processorChain.process(message, context);
            } catch (error) {
                if (error.message.includes('rate limit')) {
                    throw new Error('API rate limit reached. Please try again in a moment.');
                }
                throw error;
            }
        });
    }

    getRagProcessor() {
        return this.#ragProcessor;
    }
}

export default MessageProcessor;
