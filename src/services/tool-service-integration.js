import { AgentToolService } from './agent-tool-service.js';

class ToolServiceIntegration {
    constructor() {
        this.toolService = new AgentToolService();
    }

    // 执行任务
    async executeTask(message) {
        try {
            // 直接使用 AgentToolService 执行任务
            const result = await this.toolService.executeTask(message);
            
            // 确保输出是字符串
            let output = result.output;
            if (typeof output === 'object') {
                output = output.content || JSON.stringify(output, null, 2);
            }
            
            return {
                success: true,
                output,
                metadata: {
                    mode: 'agent',
                    toolCalls: result.intermediateSteps
                }
            };
        } catch (error) {
            console.error('任务执行错误:', error);
            return {
                success: false,
                error: error.message,
                metadata: {
                    mode: 'agent'
                }
            };
        }
    }
}

// 创建单例实例
const toolServiceIntegration = new ToolServiceIntegration();

export default toolServiceIntegration;
