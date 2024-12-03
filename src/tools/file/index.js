import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { readFile, writeFile, copyFile, rename, unlink, readdir } from 'fs/promises';
import path from 'path';
import os from 'os';

// 路径解析函数
function resolvePath(inputPath) {
    // 处理特殊路径
    if (inputPath.toLowerCase().startsWith('desktop')) {
        const desktopPath = path.join(os.homedir(), 'Desktop');
        return path.join(desktopPath, inputPath.slice(7));
    }
    return path.resolve(inputPath);
}

// 文件操作工具的 schema
const fileOperationSchema = z.object({
    operation: z.enum(['read', 'write', 'copy', 'move', 'delete', 'list'])
        .describe('文件操作类型：read(读取)、write(写入)、copy(复制)、move(移动)、delete(删除)、list(列出目录)'),
    sourcePath: z.string()
        .describe('源文件/目录路径，支持特殊路径如 desktop'),
    targetPath: z.string().optional()
        .describe('目标文件/目录路径，在 copy/move 操作时必需'),
    content: z.string().optional()
        .describe('写入的文件内容，在 write 操作时必需'),
});

// 文件操作工具
export const fileOperationTool = tool(
    async (args) => {
        try {
            // 解析路径
            const sourcePath = resolvePath(args.sourcePath);
            const targetPath = args.targetPath ? resolvePath(args.targetPath) : undefined;

            // 记录操作日志
            console.log(`[FileOperation] ${args.operation} - Source: ${sourcePath}${targetPath ? ', Target: ' + targetPath : ''}`);

            switch (args.operation) {
                case 'read':
                    const content = await readFile(sourcePath, 'utf-8');
                    return `文件内容：\n${content}`;

                case 'write':
                    if (!args.content) {
                        throw new Error('写入操作需要提供 content 参数');
                    }
                    await writeFile(sourcePath, args.content, 'utf-8');
                    return '文件写入成功';

                case 'copy':
                    if (!targetPath) {
                        throw new Error('复制操作需要提供 targetPath 参数');
                    }
                    await copyFile(sourcePath, targetPath);
                    return '文件复制成功';

                case 'move':
                    if (!targetPath) {
                        throw new Error('移动操作需要提供 targetPath 参数');
                    }
                    await rename(sourcePath, targetPath);
                    return '文件移动成功';

                case 'delete':
                    await unlink(sourcePath);
                    return '文件删除成功';

                case 'list':
                    const files = await readdir(sourcePath);
                    return `目录内容：\n${files.join('\n')}`;

                default:
                    throw new Error(`不支持的操作类型: ${args.operation}`);
            }
        } catch (error) {
            // 记录错误日志
            console.error(`[FileOperation] Error: ${error.message}`);
            return `文件操作失败: ${error.message}`;
        }
    },
    {
        name: "fileOperation",
        description: "用于执行文件操作，包括读取、写入、复制、移动、删除文件，以及列出目录内容。支持特殊路径如 desktop。",
        schema: fileOperationSchema,
    }
);
