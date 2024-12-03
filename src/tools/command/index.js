import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 安全命令列表
const SAFE_COMMANDS = [
    'dir', 'echo', 'type', 'cd', 'md', 'rd', 'copy', 'move', 'del',
    'cls', 'date', 'time', 'ver', 'vol', 'path', 'set'
];

// Windows 命令工具的 schema
const windowsCommandSchema = z.object({
    command: z.string().describe('要执行的 Windows 命令'),
});

// Windows 命令工具
export const windowsCommandTool = tool(
    async (args) => {
        try {
            // 检查命令安全性
            const command = args.command.trim().toLowerCase();
            const isCommandSafe = SAFE_COMMANDS.some(safeCmd => 
                command.startsWith(safeCmd + ' ') || command === safeCmd
            );

            if (!isCommandSafe) {
                return `不允许执行该命令：${args.command}`;
            }

            // 执行命令
            console.log(`[Command] Executing: ${args.command}`);
            const { stdout, stderr } = await execAsync(args.command);
            
            if (stderr) {
                console.error(`[Command] Error: ${stderr}`);
                return `命令执行出错：${stderr}`;
            }

            return `命令执行成功：\n${stdout}`;
        } catch (error) {
            console.error(`[Command] Error: ${error.message}`);
            return `命令执行失败：${error.message}`;
        }
    },
    {
        name: "windowsCommand",
        description: "执行安全的 Windows 命令，如：dir、echo、type 等",
        schema: windowsCommandSchema,
    }
);
