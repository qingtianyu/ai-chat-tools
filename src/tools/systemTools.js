import { Tool } from "@langchain/core/tools";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, copyFile, rename, unlink, readdir } from "fs/promises";
import { join } from "path";

const execAsync = promisify(exec);

// 计算器工具
export class CalculatorTool extends Tool {
    name = "calculator";
    description = "用于执行基本的数学计算。输入一个数学表达式，返回计算结果。支持加减乘除和括号运算。示例：expression: '(100 + 50) * 2'";

    schema = z.object({
        expression: z.string().describe("要计算的数学表达式，例如：'(100 + 50) * 2'"),
    });

    async _call(args) {
        try {
            // 使用 Function 构造函数创建一个安全的计算环境
            const calculate = new Function('return ' + args.expression);
            const result = calculate();
            return `计算结果: ${result}`;
        } catch (error) {
            return `计算错误: ${error.message}`;
        }
    }
}

// 时间工具
export class TimeTool extends Tool {
    name = "time";
    description = "获取当前时间。可以指定时区，默认为亚洲/上海时区。示例：timezone: 'Asia/Shanghai'";

    schema = z.object({
        timezone: z.string().optional().describe("时区，如 'Asia/Shanghai'，可选"),
    });

    async _call(args) {
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
    }
}

// Windows命令工具
export class WindowsCommandTool extends Tool {
    name = "windows_command";
    description = "执行Windows系统命令。支持文件搜索、目录浏览等功能。";

    schema = z.object({
        operation: z.enum(['command', 'search', 'find_in_files']).describe("操作类型：command(普通命令)、search(搜索文件)、find_in_files(搜索文件内容)"),
        command: z.string().optional().describe("要执行的Windows命令"),
        searchPath: z.string().optional().describe("搜索路径，例如 'C:\\' 或 'desktop'"),
        pattern: z.string().optional().describe("搜索模式，例如 '*.txt' 或要搜索的文本内容"),
        recursive: z.boolean().optional().describe("是否递归搜索子目录")
    });

    async _call(args) {
        try {
            // 安全检查 - 禁止危险命令
            const dangerousCommands = ['del', 'rm', 'format', 'shutdown', 'taskkill'];
            if (args.command && dangerousCommands.some(cmd => args.command.toLowerCase().includes(cmd))) {
                return '为了安全起见，该命令被禁止执行';
            }

            switch (args.operation) {
                case 'command':
                    return await this._executeCommand(args.command);
                case 'search':
                    return await this._searchFiles(args);
                case 'find_in_files':
                    return await this._findInFiles(args);
                default:
                    throw new Error(`不支持的操作: ${args.operation}`);
            }
        } catch (error) {
            console.error('[命令执行错误] >>>', error.message);
            return `命令执行错误: ${error.message}`;
        }
    }

    async _executeCommand(command) {
        console.log('\n[执行系统命令] >>>', command);

        const { stdout, stderr } = await execAsync(command, {
            encoding: 'utf8',
            maxBuffer: 1024 * 1024 * 10
        });

        if (stderr) {
            console.log('[命令错误输出] >>>', stderr);
            return `命令执行警告:\n${stderr}`;
        }

        const output = stdout.trim();
        if (!output) {
            return '命令执行成功，但没有输出';
        }

        console.log('[命令标准输出] >>>', output);
        return output;
    }

    async _searchFiles(args) {
        if (!args.searchPath || !args.pattern) {
            throw new Error('搜索文件需要提供 searchPath 和 pattern 参数');
        }

        // 解析搜索路径
        let searchPath = args.searchPath;
        if (searchPath.toLowerCase() === 'desktop') {
            searchPath = join(process.env.USERPROFILE, 'Desktop');
        } else if (searchPath.toLowerCase() === 'documents') {
            searchPath = join(process.env.USERPROFILE, 'Documents');
        } else if (searchPath.toLowerCase() === 'downloads') {
            searchPath = join(process.env.USERPROFILE, 'Downloads');
        }

        // 构建搜索命令
        const recursive = args.recursive !== false ? '/s' : '';
        const command = `dir "${searchPath}\\${args.pattern}" ${recursive} /b /a:-d`;
        
        console.log(`\n[文件搜索] >>> 在 ${searchPath} 中搜索 ${args.pattern}`);
        
        try {
            const { stdout } = await execAsync(command);
            const files = stdout.trim().split('\n').filter(Boolean);
            
            if (files.length === 0) {
                return '未找到匹配的文件';
            }

            // 格式化输出
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
        } catch (error) {
            if (error.code === 1) {
                return '未找到匹配的文件';
            }
            throw error;
        }
    }

    async _findInFiles(args) {
        if (!args.searchPath || !args.pattern) {
            throw new Error('搜索文件内容需要提供 searchPath 和 pattern 参数');
        }

        // 解析搜索路径
        let searchPath = args.searchPath;
        if (searchPath.toLowerCase() === 'desktop') {
            searchPath = join(process.env.USERPROFILE, 'Desktop');
        } else if (searchPath.toLowerCase() === 'documents') {
            searchPath = join(process.env.USERPROFILE, 'Documents');
        } else if (searchPath.toLowerCase() === 'downloads') {
            searchPath = join(process.env.USERPROFILE, 'Downloads');
        }

        // 构建搜索命令
        const recursive = args.recursive !== false ? '/s' : '';
        const command = `findstr /n /i /c:"${args.pattern}" "${searchPath}\\*.*"`;

        console.log(`\n[文件内容搜索] >>> 在 ${searchPath} 中搜索内容: ${args.pattern}`);

        try {
            const { stdout } = await execAsync(command);
            const lines = stdout.trim().split('\n').filter(Boolean);

            if (lines.length === 0) {
                return '未找到包含指定内容的文件';
            }

            // 解析结果
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

            // 格式化输出
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
        } catch (error) {
            if (error.code === 1) {
                return '未找到包含指定内容的文件';
            }
            throw error;
        }
    }
}

// 文件操作工具
export class FileOperationTool extends Tool {
    name = "file_operation";
    description = "文件操作工具，支持创建、读取、复制、移动等操作。支持指定路径，如桌面、文档等。";

    schema = z.object({
        operation: z.enum(['write', 'read', 'copy', 'move', 'delete', 'list']).describe("操作类型：write(写入)、read(读取)、copy(复制)、move(移动)、delete(删除)、list(列出目录)"),
        filename: z.string().describe("文件名，例如：'login.html'"),
        content: z.string().optional().describe("写入时的文件内容"),
        type: z.enum(['html', 'css', 'js', 'json', 'txt']).optional().describe("写入时的文件类型"),
        path: z.string().optional().describe("文件路径，例如：'desktop'表示桌面，'documents'表示文档文件夹"),
        targetPath: z.string().optional().describe("目标路径，用于复制或移动操作")
    });

    async _call(args) {
        try {
            // 解析路径
            const sourcePath = this._resolvePath(args.path);
            const sourceFilePath = join(sourcePath, args.filename);

            switch (args.operation) {
                case 'write':
                    return await this._handleWrite(sourceFilePath, args);
                case 'read':
                    return await this._handleRead(sourceFilePath);
                case 'copy':
                    return await this._handleCopy(sourceFilePath, args);
                case 'move':
                    return await this._handleMove(sourceFilePath, args);
                case 'delete':
                    return await this._handleDelete(sourceFilePath);
                case 'list':
                    return await this._handleList(sourcePath);
                default:
                    throw new Error(`不支持的操作: ${args.operation}`);
            }
        } catch (error) {
            console.error('[文件操作错误] >>>', error.message);
            return `操作失败: ${error.message}`;
        }
    }

    _resolvePath(path) {
        if (!path) return process.cwd();

        switch (path.toLowerCase()) {
            case 'desktop':
                return join(process.env.USERPROFILE, 'Desktop');
            case 'documents':
                return join(process.env.USERPROFILE, 'Documents');
            case 'downloads':
                return join(process.env.USERPROFILE, 'Downloads');
            default:
                return path;
        }
    }

    async _handleWrite(filePath, args) {
        if (!args.content) {
            throw new Error('写入操作需要提供content参数');
        }

        const allowedExtensions = ['.html', '.css', '.js', '.json', '.txt'];
        const fileExt = '.' + filePath.split('.').pop().toLowerCase();
        
        if (!allowedExtensions.includes(fileExt)) {
            throw new Error(`不支持的文件类型：${fileExt}。仅支持：${allowedExtensions.join(', ')}`);
        }

        await writeFile(filePath, args.content, 'utf8');
        console.log(`[文件写入] >>> 成功创建文件: ${filePath}`);
        return `文件已成功保存到: ${filePath}`;
    }

    async _handleRead(filePath) {
        const content = await readFile(filePath, 'utf8');
        console.log(`[文件读取] >>> 成功读取文件: ${filePath}`);
        return content;
    }

    async _handleCopy(sourcePath, args) {
        if (!args.targetPath) {
            throw new Error('复制操作需要提供targetPath参数');
        }

        const targetPath = this._resolvePath(args.targetPath);
        const targetFilePath = join(targetPath, args.filename);

        await copyFile(sourcePath, targetFilePath);
        console.log(`[文件复制] >>> 从 ${sourcePath} 复制到 ${targetFilePath}`);
        return `文件已成功复制到: ${targetFilePath}`;
    }

    async _handleMove(sourcePath, args) {
        if (!args.targetPath) {
            throw new Error('移动操作需要提供targetPath参数');
        }

        const targetPath = this._resolvePath(args.targetPath);
        const targetFilePath = join(targetPath, args.filename);

        await rename(sourcePath, targetFilePath);
        console.log(`[文件移动] >>> 从 ${sourcePath} 移动到 ${targetFilePath}`);
        return `文件已成功移动到: ${targetFilePath}`;
    }

    async _handleDelete(filePath) {
        await unlink(filePath);
        console.log(`[文件删除] >>> 成功删除文件: ${filePath}`);
        return `文件已成功删除: ${filePath}`;
    }

    async _handleList(dirPath) {
        const files = await readdir(dirPath, { withFileTypes: true });
        const result = {
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

        console.log(`[目录列表] >>> 成功读取目录: ${dirPath}`);
        return result;
    }
}
