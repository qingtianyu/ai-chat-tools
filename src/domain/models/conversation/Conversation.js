import { Entity } from '../base/Entity.js';
import { ValueObject } from '../base/ValueObject.js';
import { IdGenerator } from '../../../utils/idGenerator.js';

/**
 * 会话状态枚举
 */
export const ConversationStatus = {
    ACTIVE: 'active',
    ARCHIVED: 'archived',
    DELETED: 'deleted'
};

/**
 * 会话元数据值对象
 */
export class ConversationMetadata extends ValueObject {
    constructor({
        title = null,
        description = null,
        tags = [],
        model = 'gpt-3.5-turbo',
        temperature = 0.7,
        maxTokens = 2000
    } = {}) {
        super();
        this.title = title;
        this.description = description;
        this.tags = tags;
        this.model = model;
        this.temperature = temperature;
        this.maxTokens = maxTokens;
    }

    addTag(tag) {
        if (!this.tags.includes(tag)) {
            this.tags.push(tag);
        }
    }

    removeTag(tag) {
        const index = this.tags.indexOf(tag);
        if (index !== -1) {
            this.tags.splice(index, 1);
        }
    }

    updateModel(model) {
        this.model = model;
    }

    updateTemperature(temperature) {
        if (temperature < 0 || temperature > 1) {
            throw new Error('Temperature must be between 0 and 1');
        }
        this.temperature = temperature;
    }
}

/**
 * 会话领域模型
 */
export class Conversation extends Entity {
    constructor({
        id = IdGenerator.generateId(),
        userId,
        title = null,
        messages = [],
        status = ConversationStatus.ACTIVE,
        metadata = new ConversationMetadata(),
        createdAt = new Date(),
        updatedAt = new Date()
    }) {
        super(id);
        this.userId = userId;
        this.title = title;
        this.messages = messages;
        this.status = status;
        this.metadata = metadata;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    addMessage(message) {
        this.messages.push(message);
        this.updatedAt = new Date();
    }

    removeMessage(messageId) {
        this.messages = this.messages.filter(msg => msg.id !== messageId);
        this.updatedAt = new Date();
    }

    archive() {
        if (this.status === ConversationStatus.ARCHIVED) {
            throw new Error('Conversation is already archived');
        }
        this.status = ConversationStatus.ARCHIVED;
        this.updatedAt = new Date();
    }

    activate() {
        if (this.status === ConversationStatus.ACTIVE) {
            throw new Error('Conversation is already active');
        }
        this.status = ConversationStatus.ACTIVE;
        this.updatedAt = new Date();
    }

    updateMetadata(metadata) {
        this.metadata = new ConversationMetadata({
            ...this.metadata,
            ...metadata
        });
        this.updatedAt = new Date();
    }

    getMessageCount() {
        return this.messages.length;
    }

    getLastMessage() {
        return this.messages[this.messages.length - 1] || null;
    }

    isActive() {
        return this.status === ConversationStatus.ACTIVE;
    }

    isArchived() {
        return this.status === ConversationStatus.ARCHIVED;
    }
}
