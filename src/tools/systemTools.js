import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, copyFile, rename, unlink, readdir } from "fs/promises";
import { join } from "path";
import { homedir } from 'os';

const execAsync = promisify(exec);

// 计算器工具
const calculatorSchema = z.object({
    expression: z.string().describe("要计算的数学表达式，例如：'(100 + 50) * 2'"),
});

export const calculatorTool = tool(
    async (args) => {
        try {
            const calculate = new Function('return ' + args.expression);
            const result = calculate();
            return `计算结果: ${result}`;
        } catch (error) {
            return `计算错误: ${error.message}`;
        }
    },
    {
        name: "calculator",
        description: "用于执行基本的数学计算。输入一个数学表达式，返回计算结果。支持加减乘除和括号运算。示例：expression: '(100 + 50) * 2'",
        schema: calculatorSchema,
    }
);

// 时间工具
const timeSchema = z.object({
    timezone: z.string().optional().describe("时区，如 'Asia/Shanghai'，可选"),
});

export const timeTool = tool(
    async (args) => {
        try {
            const date = new Date();
            const options = {
                timeZone: args.timezone || 'Asia/Shanghai',
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric',
                hour12: false
            };
            
            return `当前时间: ${date.toLocaleString('zh-CN', options)}`;
        } catch (error) {
            return `获取时间错误: ${error.message}`;
        }
    },
    {
        name: "time",
        description: "获取当前时间。可以指定时区，默认为亚洲/上海时区。示例：timezone: 'Asia/Shanghai'",
        schema: timeSchema,
    }
);

// Windows命令工具
const commandSchema = z.object({
    operation: z.enum(['command', 'search', 'find_in_files']).describe("操作类型：command(普通命令)、search(搜索文件)、find_in_files(搜索文件内容)"),
    command: z.string().optional().describe("要执行的Windows命令"),
    searchPath: z.string().optional().describe("搜索路径，例如 'C:\\' 或 'desktop'"),
    pattern: z.string().optional().describe("搜索模式，例如 '*.txt' 或要搜索的文本内容"),
    recursive: z.boolean().optional().describe("是否递归搜索子目录")
});

// 获取桌面路径
function getDesktopPath() {
    return join(homedir(), 'Desktop');
}

// 解析路径
function resolvePath(path) {
    if (!path || path === '.') return process.cwd();
    if (path.toLowerCase() === 'desktop') return getDesktopPath();
    return join(process.cwd(), path);
}

// 文件操作工具
const fileOperationSchema = z.object({
    operation: z.enum(['write', 'read', 'copy', 'move', 'delete', 'list']),
    filename: z.string(),
    content: z.string().optional(),
    targetPath: z.string().optional(),
});

export const windowsCommandTool = tool(
    async (args) => {
        try {
            // 安全检查 - 禁止危险命令
            if (args.command) {
                const dangerousCommands = ['del', 'rm', 'format', 'shutdown', 'taskkill'];
                if (dangerousCommands.some(cmd => args.command.toLowerCase().includes(cmd))) {
                    return '为了安全起见，该命令被禁止执行';
                }
            }

            switch (args.operation) {
                case 'command': {
                    console.log('\n[执行系统命令] >>>', args.command);
                    const { stdout, stderr } = await execAsync(args.command, { encoding: 'utf8' });
                    if (stderr) {
                        console.error('[命令执行错误] >>>', stderr);
                        return `命令执行出错: ${stderr}`;
                    }
                    console.log('[命令标准输出] >>>', stdout);
                    return stdout;
                }
                
                case 'search': {
                    if (!args.searchPath || !args.pattern) {
                        throw new Error('搜索文件需要提供 searchPath 和 pattern 参数');
                    }

                    const searchPath = resolvePath(args.searchPath);
                    const recursive = args.recursive !== false ? '/s' : '';
                    const command = `dir "${searchPath}\\${args.pattern}" ${recursive} /b /a:-d`;
                    
                    console.log(`\n[文件搜索] >>> 在 ${searchPath} 中搜索 ${args.pattern}`);
                    
                    const { stdout } = await execAsync(command);
                    const files = stdout.trim().split('\n').filter(Boolean);
                    
                    if (files.length === 0) {
                        return '未找到匹配的文件';
                    }

                    const result = {
                        searchPath,
                        pattern: args.pattern,
                        count: files.length,
                        files: files.map(file => ({
                            name: file.split('\\').pop(),
                            path: file.trim()
                        }))
                    };

                    console.log(`[搜索结果] >>> 找到 ${files.length} 个文件`);
                    return result;
                }
                
                case 'find_in_files': {
                    if (!args.searchPath || !args.pattern) {
                        throw new Error('搜索文件内容需要提供 searchPath 和 pattern 参数');
                    }

                    const searchPath = resolvePath(args.searchPath);
                    const command = `findstr /n /i /c:"${args.pattern}" "${searchPath}\\*.*"`;

                    console.log(`\n[文件内容搜索] >>> 在 ${searchPath} 中搜索内容: ${args.pattern}`);

                    const { stdout } = await execAsync(command);
                    const lines = stdout.trim().split('\n').filter(Boolean);

                    if (lines.length === 0) {
                        return '未找到包含指定内容的文件';
                    }

                    const results = {};
                    for (const line of lines) {
                        const [file, lineNum, ...contentParts] = line.split(':');
                        const content = contentParts.join(':').trim();
                        
                        if (!results[file]) {
                            results[file] = [];
                        }
                        
                        results[file].push({
                            line: parseInt(lineNum),
                            content
                        });
                    }

                    const formattedResults = {
                        searchPath,
                        pattern: args.pattern,
                        matchCount: lines.length,
                        files: Object.entries(results).map(([file, matches]) => ({
                            name: file.split('\\').pop(),
                            path: file,
                            matches
                        }))
                    };

                    console.log(`[搜索结果] >>> 在 ${Object.keys(results).length} 个文件中找到 ${lines.length} 处匹配`);
                    return formattedResults;
                }
                
                default:
                    throw new Error(`不支持的操作: ${args.operation}`);
            }
        } catch (error) {
            console.error('[命令执行错误] >>>', error.message);
            return `命令执行错误: ${error.message}`;
        }
    },
    {
        name: "windows_command",
        description: "执行Windows系统命令。支持文件搜索、目录浏览等功能。",
        schema: commandSchema,
    }
);

// 文件操作工具
const fileSchema = z.object({
    operation: z.enum(['write', 'read', 'copy', 'move', 'delete', 'list']).describe("操作类型：write(写入)、read(读取)、copy(复制)、move(移动)、delete(删除)、list(列出目录)"),
    filename: z.string().describe("文件名，例如：'login.html'").optional(),
    content: z.string().optional().describe("写入时的文件内容"),
    type: z.enum(['html', 'css', 'js', 'json', 'txt']).optional().describe("写入时的文件类型"),
    path: z.string().optional().describe("文件路径，例如：'desktop'表示桌面，'documents'表示文档文件夹"),
    targetPath: z.string().optional().describe("目标路径，用于复制或移动操作")
}).refine(data => {
    // 如果操作不是 list，则 filename 是必需的
    if (data.operation !== 'list' && !data.filename) {
        throw new Error('filename 参数是必需的，除非操作是 list');
    }
    return true;
});

export const fileOperationTool = tool(
    async (args) => {
        try {
            let sourcePath, sourceFilePath;
            if (args.filename) {
                sourcePath = resolvePath(args.path);
                sourceFilePath = join(sourcePath, args.filename);
            } else {
                sourcePath = resolvePath(args.path || '.');
            }

            switch (args.operation) {
                case 'write': {
                    if (!args.content) {
                        throw new Error('写入操作需要提供content参数');
                    }

                    const allowedExtensions = ['.html', '.css', '.js', '.json', '.txt'];
                    const fileExt = '.' + sourceFilePath.split('.').pop().toLowerCase();
                    
                    if (!allowedExtensions.includes(fileExt)) {
                        throw new Error(`不支持的文件类型：${fileExt}。仅支持：${allowedExtensions.join(', ')}`);
                    }

                    await writeFile(sourceFilePath, args.content, 'utf8');
                    console.log(`[文件写入] >>> 成功创建文件: ${sourceFilePath}`);
                    return `文件已成功保存到: ${sourceFilePath}`;
                }
                
                case 'read': {
                    const content = await readFile(sourceFilePath, 'utf8');
                    console.log(`[文件读取] >>> 成功读取文件: ${sourceFilePath}`);
                    return content;
                }
                
                case 'copy': {
                    if (!args.targetPath) {
                        throw new Error('复制操作需要提供targetPath参数');
                    }

                    const targetPath = resolvePath(args.targetPath);
                    const targetFilePath = join(targetPath, args.filename);

                    await copyFile(sourceFilePath, targetFilePath);
                    console.log(`[文件复制] >>> 从 ${sourceFilePath} 复制到 ${targetFilePath}`);
                    return `文件已成功复制到: ${targetFilePath}`;
                }
                
                case 'move': {
                    if (!args.targetPath) {
                        throw new Error('移动操作需要提供targetPath参数');
                    }

                    const targetPath = resolvePath(args.targetPath);
                    const targetFilePath = join(targetPath, args.filename);

                    await rename(sourceFilePath, targetFilePath);
                    console.log(`[文件移动] >>> 从 ${sourceFilePath} 移动到 ${targetFilePath}`);
                    return `文件已成功移动到: ${targetFilePath}`;
                }
                
                case 'delete': {
                    await unlink(sourceFilePath);
                    console.log(`[文件删除] >>> 成功删除文件: ${sourceFilePath}`);
                    return `文件已成功删除: ${sourceFilePath}`;
                }
                
                case 'list': {
                    const files = await readdir(sourcePath, { withFileTypes: true });
                    const result = {
                        path: sourcePath,
                        files: [],
                        directories: []
                    };

                    for (const file of files) {
                        if (file.isFile()) {
                            result.files.push(file.name);
                        } else if (file.isDirectory()) {
                            result.directories.push(file.name);
                        }
                    }

                    console.log(`[目录列表] >>> 成功读取目录: ${sourcePath}`);
                    return result;
                }
                
                default:
                    throw new Error(`不支持的操作: ${args.operation}`);
            }
        } catch (error) {
            console.error('[文件操作错误] >>>', error.message);
            return `操作失败: ${error.message}`;
        }
    },
    {
        name: "file_operation",
        description: "文件操作工具，支持创建、读取、复制、移动等操作。支持指定路径，如桌面、文档等。",
        schema: fileSchema,
    }
);
