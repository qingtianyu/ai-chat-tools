import BaseProcessor from './BaseProcessor.js';
import OpenAIClient from '../../../utils/OpenAIClient.js';
import CONFIG from '../../../config/index.js';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';

class DefaultProcessor extends BaseProcessor {
    #openAIClient;

    constructor() {
        super();
        this.#openAIClient = OpenAIClient.getInstance();
    }

    async process(message, context) {
        const messages = [
            new SystemMessage(CONFIG.systemPrompts.default),
            ...context.conversation.messages.map(msg => 
                msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
            ),
            new HumanMessage(message)
        ];

        const result = await this.#openAIClient.chatClient.invoke(messages);

        context.conversation.messages.push(
            { role: 'user', content: message },
            { role: 'assistant', content: result.content }
        );

        return this.createResponse(
            context.conversation.messages,
            { 
                mode: 'chat',
                model: CONFIG.openai.modelName
            },
            context.conversation.id
        );
    }
}

export default DefaultProcessor;
