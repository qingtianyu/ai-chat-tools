import { CalculatorTool, TimeTool, WindowsCommandTool, FileOperationTool } from './systemTools.js';

/**
 * 创建工具实例
 * @param {Object} params 参数对象
 * @param {Object} params.datasource 数据库连接实例
 * @param {Object} params.model 语言模型实例
 * @param {Object} params.embeddings 嵌入模型实例
 * @returns {Object} 工具实例对象
 */
export function createTools({ datasource, model, embeddings }) {
    return {
        // SQL工具
        sqlTools: {
            sqlExecutionTool: new SQLExecutionTool(datasource, model)
        },
        
        // 浏览器工具
        browserTools: {
            webBrowserTool: new WebBrowserTool({ model, embeddings })
        },
        
        // 系统工具
        systemTools: {
            calculatorTool: new CalculatorTool(),
            timeTool: new TimeTool(),
            windowsCommandTool: new WindowsCommandTool(),
            fileOperationTool: new FileOperationTool()
        }
    };
}

/**
 * 获取所有工具列表
 * @param {Object} params 参数对象
 * @param {Object} params.datasource 数据库连接实例
 * @param {Object} params.model 语言模型实例
 * @param {Object} params.embeddings 嵌入模型实例
 * @returns {Array} 工具实例数组
 */
export function getAllTools({ datasource, model, embeddings }) {
    const tools = createTools({ datasource, model, embeddings });
    return [
        ...Object.values(tools.sqlTools),
        ...Object.values(tools.browserTools),
        ...Object.values(tools.systemTools)
    ];
}

// 导出单个工具类
export {
    TimeTool,
    CalculatorTool,
    WindowsCommandTool,
    FileOperationTool
};
