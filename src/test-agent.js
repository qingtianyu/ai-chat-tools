import toolServiceIntegration from './services/tool-service-integration.js';

async function testToolService() {
    console.log('\n=== 测试工具服务 ===\n');

    const testCases = [
        {
            name: '计算器工具',
            input: '计算 (100 + 50) * 2'
        },
        {
            name: '时间工具',
            input: '查看上海时间'
        },
        {
            name: '文件操作',
            input: '在桌面创建文件 test.txt 内容为 Hello World'
        },
        {
            name: '命令执行',
            input: '执行命令 dir'
        }
    ];

    for (const testCase of testCases) {
        try {
            console.log(`\n${testCase.name} 测试:`);
            console.log('输入:', testCase.input);
            
            const result = await toolServiceIntegration.executeToolCommand(testCase.input);
            console.log('执行结果:', JSON.stringify(result, null, 2));
            
            if (result.success) {
                const formatted = toolServiceIntegration.formatToolOutput(result);
                console.log('格式化输出:', formatted);
            } else {
                console.error('执行失败:', result.error);
            }
        } catch (error) {
            console.error(`${testCase.name}测试失败:`, error);
        }
    }
}

// 运行测试
console.log('开始工具服务测试...\n');
testToolService().catch(error => {
    console.error('测试过程出错:', error);
    process.exit(1);
});
