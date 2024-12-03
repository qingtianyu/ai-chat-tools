class ChatError extends Error {
    constructor(message, code, metadata = {}) {
        super(message);
        this.name = 'ChatError';
        this.code = code;
        this.metadata = metadata;
        this.timestamp = new Date();
    }
}

export const ErrorCodes = {
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
    OPENAI_ERROR: 'OPENAI_ERROR',
    RAG_ERROR: 'RAG_ERROR',
    AGENT_ERROR: 'AGENT_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR'
};

class ErrorHandler {
    static handle(error, context = {}) {
        console.error(`Error in ${context.location || 'unknown location'}:`, error);

        // 如果已经是 ChatError，直接返回
        if (error instanceof ChatError) {
            return {
                success: false,
                error: error.message,
                code: error.code,
                metadata: {
                    ...error.metadata,
                    timestamp: error.timestamp
                }
            };
        }

        // 转换常见错误类型
        if (error.name === 'OpenAIError') {
            return {
                success: false,
                error: 'OpenAI API 调用失败',
                code: ErrorCodes.OPENAI_ERROR,
                metadata: {
                    originalError: error.message,
                    timestamp: new Date()
                }
            };
        }

        // 默认错误处理
        return {
            success: false,
            error: error.message || '发生未知错误',
            code: ErrorCodes.INTERNAL_ERROR,
            metadata: {
                originalError: error.message,
                timestamp: new Date()
            }
        };
    }

    static throw(message, code, metadata = {}) {
        throw new ChatError(message, code, metadata);
    }
}

export { ChatError, ErrorHandler };
