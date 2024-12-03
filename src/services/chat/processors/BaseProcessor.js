import { ErrorHandler } from '../../../utils/ErrorHandler.js';

export class BaseProcessor {
    #next = null;

    setNext(processor) {
        this.#next = processor;
        return processor;
    }

    async process(message, context) {
        throw new Error('process() must be implemented by subclass');
    }

    async processNext(message, context) {
        if (this.#next) {
            return await this.#next.process(message, context);
        }
        return null;
    }

    createResponse(messages, metadata = {}, conversationId) {
        return {
            success: true,
            messages,
            metadata,
            conversationId
        };
    }
}

export default BaseProcessor;
