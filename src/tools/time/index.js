import { tool } from "@langchain/core/tools";
import { z } from "zod";

// 时间工具的 schema
const timeSchema = z.object({
    format: z.string().optional().describe('时间格式，例如：YYYY-MM-DD HH:mm:ss'),
    type: z.string().optional().describe('时间类型：time(时间)、date(日期)、full(完整)')
});

// 时间工具
export const timeTool = tool(
    async ({ format, type = 'full' }) => {
        try {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false });
            const dateStr = now.toLocaleDateString('zh-CN');
            
            switch (type.toLowerCase()) {
                case 'time':
                    return timeStr;
                case 'date':
                    return dateStr;
                case 'full':
                default:
                    return `${dateStr} ${timeStr}`;
            }
        } catch (error) {
            return `获取时间失败：${error.message}`;
        }
    },
    {
        name: "time",
        description: "获取当前时间或日期。可以查询具体时间(time)、日期(date)或完整时间(full)",
        schema: timeSchema,
    }
);
