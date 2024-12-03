import BaseProcessor from './BaseProcessor.js';
import toolServiceIntegration from '../../../services/tool-service-integration.js';

class AgentProcessor extends BaseProcessor {
    async process(message, context) {
        try {
            // 尝试使用 agent 处理消息
            const agentResult = await toolServiceIntegration.executeTask(message);
            
            if (!agentResult.success) {
                return await this.processNext(message, context);
            }

            // 更新会话历史
            const { conversation } = context;
            conversation.messages.push(
                { role: 'user', content: message },
                { role: 'assistant', content: agentResult.output }
            );

            return this.createResponse(
                conversation.messages,
                { 
                    mode: 'agent',
                    ...agentResult.metadata
                },
                conversation.id
            );
        } catch (error) {
            console.error('Agent处理失败:', error);
            // Agent处理失败，继续下一个处理器
            return await this.processNext(message, context);
        }
    }
}

export default AgentProcessor;
