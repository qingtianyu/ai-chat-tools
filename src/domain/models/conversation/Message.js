import { Entity } from '../base/Entity.js';
import { ValueObject } from '../base/ValueObject.js';
import { IdGenerator } from '../../../utils/idGenerator.js';

/**
 * 消息类型枚举
 */
export const MessageType = {
    USER: 'user',
    ASSISTANT: 'assistant',
    SYSTEM: 'system',
    ERROR: 'error'
};

/**
 * 消息元数据值对象
 */
export class MessageMetadata extends ValueObject {
    constructor({
        model = null,
        tokens = null,
        processingTime = null,
        ragEnabled = false,
        knowledgeBaseIds = []
    } = {}) {
        super();
        this.model = model;
        this.tokens = tokens;
        this.processingTime = processingTime;
        this.ragEnabled = ragEnabled;
        this.knowledgeBaseIds = knowledgeBaseIds;
    }

    setProcessingMetrics(model, tokens, processingTime) {
        this.model = model;
        this.tokens = tokens;
        this.processingTime = processingTime;
    }

    addKnowledgeBaseId(knowledgeBaseId) {
        if (!this.knowledgeBaseIds.includes(knowledgeBaseId)) {
            this.knowledgeBaseIds.push(knowledgeBaseId);
        }
    }

    enableRag() {
        this.ragEnabled = true;
    }

    disableRag() {
        this.ragEnabled = false;
        this.knowledgeBaseIds = [];
    }
}

/**
 * 消息领域模型
 */
export class Message extends Entity {
    constructor({
        id = IdGenerator.generateId(),
        conversationId,
        content,
        type = MessageType.USER,
        metadata = new MessageMetadata(),
        createdAt = new Date()
    }) {
        super(id);
        this.conversationId = conversationId;
        this.content = content;
        this.type = type;
        this.metadata = metadata;
        this.createdAt = createdAt;
    }

    updateContent(content) {
        this.content = content;
    }

    addMetadata(key, value) {
        this.metadata[key] = value;
    }

    getMetadata(key) {
        return this.metadata[key];
    }

    isSystemMessage() {
        return this.type === MessageType.SYSTEM;
    }

    isErrorMessage() {
        return this.type === MessageType.ERROR;
    }

    isUserMessage() {
        return this.type === MessageType.USER;
    }

    isAssistantMessage() {
        return this.type === MessageType.ASSISTANT;
    }
}
