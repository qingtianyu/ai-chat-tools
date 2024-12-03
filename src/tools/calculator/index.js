import { tool } from "@langchain/core/tools";
import { z } from "zod";

// 计算器工具的 schema
const calculatorSchema = z.object({
    expression: z.string().describe('要计算的数学表达式，例如：1 + 2 * 3'),
});

// 计算器工具
export const calculatorTool = tool(
    async (args) => {
        try {
            // 使用 Function 构造函数创建一个安全的计算环境
            const result = new Function('return ' + args.expression)();
            return `计算结果：${result}`;
        } catch (error) {
            return `计算失败：${error.message}`;
        }
    },
    {
        name: "calculator",
        description: "用于计算数学表达式。例如：1 + 2 * 3",
        schema: calculatorSchema,
    }
);
