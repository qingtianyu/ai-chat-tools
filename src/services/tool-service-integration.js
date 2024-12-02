import { AgentToolService } from './agent-tool-service.js';

class ToolServiceIntegration {
    constructor() {
        this.toolService = new AgentToolService();
    }

    // 获取工具类型
    getToolType(message) {
        const TOOL_TRIGGERS = {
            calculator: ['计算', '等于', '='],
            time: ['时间', '几点', '日期'],
            windows_command: ['执行命令', '运行命令', 'cmd'],
            file_operation: ['文件', '创建', '读取', '写入', '删除']
        };

        for (const [type, triggers] of Object.entries(TOOL_TRIGGERS)) {
            if (triggers.some(trigger => message.includes(trigger))) {
                return type;
            }
        }

        return null;
    }

    // 执行工具命令
    async executeToolCommand(message) {
        try {
            const result = await this.toolService.executeTask(message);
            
            // 如果执行成功，直接返回输出结果
            if (result.success) {
                return {
                    success: true,
                    output: result.output,
                    toolType: result.toolType
                };
            }

            // 如果执行失败，返回错误信息
            return {
                success: false,
                error: result.error || '工具执行失败',
                toolType: result.toolType
            };
        } catch (error) {
            console.error('工具执行错误:', error);
            return {
                success: false,
                error: error.message,
                toolType: null
            };
        }
    }

    // 格式化工具输出
    formatToolOutput(result) {
        if (!result.success) {
            return `执行失败: ${result.error}`;
        }
        return result.output;
    }
}

// 创建单例实例
const toolServiceIntegration = new ToolServiceIntegration();

export default toolServiceIntegration;
