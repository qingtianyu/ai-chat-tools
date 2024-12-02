import readline from 'readline';
import { chat, toggleRag } from './chatbot.js';
import userStore from './services/user-store-singleton.js';
import { DatabaseService } from './services/database.js';
import { InitService } from './services/init-service.js';
import ragService from './services/rag-service-singleton.js';
import chalk from 'chalk';
import fs from 'fs/promises';  // 使用 promises API

let rl;

const db = new DatabaseService();
const initService = new InitService();
let currentUserId = null;
let currentConversationId = null;
let userName = null;
let isRagEnabled = false;
let isDebugMode = false;
let thinkingAnimation = null;

// 初始化调试模式
process.env.DEBUG = '';  // 默认关闭调试模式

// 思考动画帧
const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let frameIndex = 0;

// 显示思考动画
function startThinking(message = '思考中') {
    if (thinkingAnimation) return;
    
    frameIndex = 0;
    process.stdout.write('\n');
    thinkingAnimation = setInterval(() => {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        const frame = frames[frameIndex];
        process.stdout.write(
            chalk.cyan(`${frame} ${message}${'.'.repeat(Math.floor(frameIndex / 3) % 4)}`)
        );
        frameIndex = (frameIndex + 1) % frames.length;
    }, 150); // 降低动画速度
}

// 停止思考动画
function stopThinking() {
    if (thinkingAnimation) {
        clearInterval(thinkingAnimation);
        thinkingAnimation = null;
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write('\n'); // 添加换行，确保后续输出不受影响
    }
}

// 清屏函数
function clearScreen() {
    process.stdout.write('\x1Bc');
}

// 显示欢迎信息
function showWelcome() {
    console.log(chalk.blue('\n=== 🤖 AI 智能助手 ==='));
    if (userName) {
        console.log(chalk.green(`👋 欢迎回来, ${userName}!`));
    }
    console.log(chalk.gray('🆔 用户ID:', currentUserId));
    console.log(chalk.gray('💭 会话ID:', currentConversationId || '新会话'));
    console.log('\n📝 可用命令:');
    console.log(chalk.yellow('- new:     ✨ 开始新对话'));
    console.log(chalk.yellow('- list:    📜 查看历史对话'));
    console.log(chalk.yellow('- name:    👤 设置用户名'));
    console.log(chalk.yellow('- rag:     🧠 切换专业知识模式'));
    console.log(chalk.yellow('  • rag single       单知识库模式 (需要先用 kb switch 选择)'));
    console.log(chalk.yellow('  • rag multi        多知识库模式 (自动使用所有知识库)'));
    console.log(chalk.yellow('- kb:      📚 知识库管理'));
    console.log(chalk.yellow('  • kb list          列出所有知识库'));
    console.log(chalk.yellow('  • kb add <path>    添加新知识库'));
    console.log(chalk.yellow('  • kb del <n>       删除知识库'));
    console.log(chalk.yellow('  • kb switch <n>    切换知识库'));
    console.log(chalk.yellow('  • kb status        查看知识库状态'));
    console.log(chalk.yellow('- debug:   🔍 切换调试模式'));
    console.log(chalk.yellow('- clear:   🧹 清除屏幕'));
    console.log(chalk.yellow('- init:    🔄 初始化系统 (清除所有数据)'));
    console.log(chalk.yellow('- exit:    👋 退出程序'));
    console.log(chalk.yellow('- help:    🤔 显示帮助信息'));
    console.log('');
}

// 显示帮助信息
function showHelp() {
    console.log(chalk.blue('\n=== 🎯 命令帮助 ===\n'));
    const commands = [
        { cmd: '/list', desc: '显示历史会话列表' },
        { cmd: '/switch', desc: '切换到指定会话' },
        { cmd: '/new', desc: '创建新会话' },
        { cmd: '/clear', desc: '清除当前会话上下文' },
        { cmd: '/help', desc: '显示此帮助信息' },
        { cmd: '/exit', desc: '退出应用程序' }
    ];

    commands.forEach(({ cmd, desc }) => {
        console.log(chalk.yellow(cmd.padEnd(15)) + chalk.gray(desc));
    });
    console.log(); // 空行
}

// 从数据库获取会话列表
async function getConversationsFromDB() {
    try {
        console.log('DEBUG: 尝试从数据库获取会话...');
        console.log('DEBUG: currentUserId =', currentUserId);
        const conversations = await db.getUserConversations(currentUserId);
        console.log('DEBUG: 数据库会话数量:', conversations?.length || 0);
        return conversations;
    } catch (error) {
        console.error('从数据库获取会话失败:', error);
        return null;
    }
}

// 从 UserStore 获取会话列表
async function getConversationsFromStore() {
    try {
        console.log('DEBUG: 尝试从 UserStore 获取会话...');
        console.log('DEBUG: currentUserId =', currentUserId);
        const user = await userStore.getUserData(currentUserId);
        
        if (!user) {
            console.log('DEBUG: 未找到用户数据');
            return null;
        }
        
        console.log('DEBUG: 用户数据:', {
            id: user.id,
            conversationsCount: user.conversations?.length || 0,
            hasConversations: !!user.conversations
        });
        
        if (!user.conversations) {
            console.log('DEBUG: 用户没有会话记录');
            return [];
        }

        const formattedConversations = user.conversations.map(conv => ({
            id: conv.id,
            createdAt: conv.messages[0]?.timestamp || conv.created || Date.now(),
            firstMessage: conv.messages[0]?.content,
            lastMessage: conv.messages[conv.messages.length - 1]?.content,
            messageCount: conv.messages.length
        }));
        
        console.log('DEBUG: 格式化后的会话:', {
            count: formattedConversations.length,
            firstConversation: formattedConversations[0] ? {
                id: formattedConversations[0].id,
                messageCount: formattedConversations[0].messageCount
            } : null
        });
            
        return formattedConversations;
    } catch (error) {
        console.error('从 UserStore 获取会话失败:', error);
        console.error('错误详情:', error.stack);
        return null;
    }
}

// 显示历史对话列表
async function showConversationList() {
    console.log('DEBUG: 开始获取会话列表...');
    
    // 优先从数据库获取，如果失败或为空则从 UserStore 获取
    let conversations = await getConversationsFromDB();
    console.log('DEBUG: 数据库获取结果:', conversations ? `成功，获取到 ${conversations.length} 条会话` : '失败');
    
    if (!conversations || conversations.length === 0) {
        console.log('DEBUG: 数据库无数据，尝试从 UserStore 获取...');
        conversations = await getConversationsFromStore();
        console.log('DEBUG: UserStore 获取结果:', 
            conversations ? `成功，获取到 ${conversations.length} 条会话` : '失败');
    }
    
    if (!conversations || conversations.length === 0) {
        console.log(chalk.yellow('\n📭 暂无历史对话\n'));
        return null;
    }

    console.log(chalk.blue('\n=== 📚 历史对话列表 ==='));
    conversations.forEach((conv, index) => {
        const date = new Date(conv.createdAt).toLocaleString();
        console.log(chalk.yellow(`\n${index + 1}. 📅 ${date}`));
        // 显示完整会话ID
        console.log(chalk.gray(`🔑 ID: ${conv.id}`));
        
        if (conv.firstMessage) {
            console.log(chalk.gray('🎯 开始: ') + conv.firstMessage.substring(0, 50) + (conv.firstMessage.length > 50 ? '...' : ''));
        }
        if (conv.lastMessage) {
            console.log(chalk.gray('💬 最新: ') + conv.lastMessage.substring(0, 50) + (conv.lastMessage.length > 50 ? '...' : ''));
        }
        console.log(chalk.gray(`📊 消息数: ${conv.messageCount}`));
        if (conv.id === currentConversationId) {
            console.log(chalk.green('✅ (当前对话)'));
        }
    });

    const answer = await new Promise(resolve => {
        rl.question(chalk.yellow('\n🔍 请选择对话编号(1-' + conversations.length + ')，或按回车取消: '), resolve);
    });

    const index = parseInt(answer) - 1;
    if (isNaN(index) || index < 0 || index >= conversations.length) {
        return null;
    }

    return conversations[index].id;
}

// 初始化用户
async function initializeUser() {
    try {
        // 检查是否有保存的用户ID
        let savedUserId = null;
        try {
            savedUserId = (await fs.readFile('.user-id', 'utf8')).trim();
            console.log('Found saved user ID:', savedUserId);
        } catch (error) {
            console.log(chalk.yellow('未找到已保存的用户ID，将创建新用户。'));
        }

        if (savedUserId) {
            const userData = await userStore.getUser(savedUserId);
            console.log('User data:', userData);
            if (userData) {
                currentUserId = savedUserId;
                userName = userData.name || null;
                console.log(chalk.green(`👋 欢迎回来${userName ? '，' + userName : ''}！`));
                return;
            } else {
                console.log('❌ Saved user ID not found in store:', savedUserId);
            }
        }

        // 创建新用户
        currentUserId = await userStore.generateUserId();
        await fs.writeFile('.user-id', currentUserId);
        
        // 确保用户数据被正确保存
        const success = await userStore.saveUser(currentUserId, { 
            id: currentUserId,
            name: null,
            created: new Date().toISOString()
        });
        
        if (!success) {
            throw new Error('Failed to save new user');
        }
        
        console.log(chalk.green('✨ 已创建新用户'));
        console.log(chalk.yellow('\n👋 欢迎新用户！输入 "name" 来设置你的名字。\n'));
    } catch (error) {
        console.error('Error initializing user:', error);
        throw error;
    }
}

// 处理用户输入
async function handleInput(input) {
    input = input.trim();
    if (!input) return true;

    const [command, ...args] = input.split(' ');

    if (input.startsWith('/')) {
        switch (input.trim()) {
            case '/list':
                const selectedId = await showConversationList();
                if (selectedId) {
                    currentConversationId = selectedId;
                    clearScreen();
                    console.log(chalk.green('📜 已切换到选定的对话'));
                    showWelcome();
                }
                break;
            case '/new':
                currentConversationId = null;
                clearScreen();
                console.log(chalk.green('✨ 开始新对话'));
                showWelcome();
                break;
            case '/clear':
                clearScreen();
                showWelcome();
                break;
            case '/exit':
                console.log(chalk.yellow('\n👋 感谢使用，再见！'));
                rl.close();
                return false;
            case '/help':
                showHelp();
                break;
            default:
                console.log(chalk.red('❌ 未知的命令'));
        }
        return true;
    }

    switch (command.toLowerCase()) {
        case 'help':
        case '/help':
            showHelp();
            break;
        case 'exit':
        case '/exit':
            console.log(chalk.yellow('\n👋 感谢使用，再见！'));
            rl.close();
            return false;
        case 'clear':
        case '/clear':
            clearScreen();
            showWelcome();
            break;
        case 'list':
        case '/list':
            const selectedId = await showConversationList();
            if (selectedId) {
                currentConversationId = selectedId;
                clearScreen();
                console.log(chalk.green('📜 已切换到选定的对话'));
                showWelcome();
            }
            break;
        case 'new':
        case '/new':
            currentConversationId = null;
            clearScreen();
            console.log(chalk.green('✨ 开始新对话'));
            showWelcome();
            break;
        case 'rag':
            startThinking('切换模式');
            let mode = null;
            if (args.length > 0) {
                mode = args[0].toLowerCase();
                if (mode !== 'single' && mode !== 'multi') {
                    stopThinking();
                    console.log(chalk.red('❌ 无效的模式，只支持 single 或 multi'));
                    return true;
                }
            }
            const currentStatus = await toggleRag(!isRagEnabled, mode);
            stopThinking();
            console.log(chalk.green(`\n🧠 ${currentStatus.message}`));
            return true;
        case 'kb':
            if (args.length < 1) {
                console.log(chalk.red('❌ 请指定知识库操作：list, add, del, switch, status'));
                return true;
            }
            
            const subCommand = args[0].toLowerCase();
            startThinking('处理知识库');
            
            try {
                switch (subCommand) {
                    case 'list':
                        try {
                            const status = await ragService.getKnowledgeBaseStatus();
                            const kbs = status.loadedKnowledgeBases;
                            stopThinking();
                            console.log('\n\n📚 知识库列表:');
                            if (kbs.length === 0) {
                                console.log(chalk.yellow('  暂无知识库'));
                            } else {
                                for (const kb of kbs) {
                                    // 在多知识库模式下全部选中，单知识库模式下只选中当前知识库
                                    const isActive = status.mode === 'multi' || kb === status.currentKnowledgeBase;
                                    console.log(`  ${isActive ? '✓' : ' '} ${kb}`);
                                }
                            }
                        } catch (error) {
                            stopThinking();
                            console.log(chalk.red('\n❌ 获取知识库列表失败：' + error.message));
                        }
                        break;
                        
                    case 'add':
                        if (args.length < 2) {
                            stopThinking();
                            console.log(chalk.red('❌ 请指定文件路径'));
                            return true;
                        }
                        const filePath = args[1];
                        const result = await ragService.addKnowledgeBase(filePath);
                        stopThinking();
                        if (result.success) {
                            console.log(chalk.green(`\n✅ ${result.message}`));
                        } else {
                            console.log(chalk.red(`\n❌ ${result.message}`));
                        }
                        break;
                        
                    case 'del':
                        if (args.length < 2) {
                            stopThinking();
                            console.log(chalk.red('❌ 请指定知识库名称'));
                            return true;
                        }
                        const kbName = args[1];
                        await ragService.removeKnowledgeBase(kbName);
                        stopThinking();
                        console.log(chalk.green(`\n✅ 知识库 "${kbName}" 删除成功`));
                        break;
                        
                    case 'switch':
                        if (args.length < 2) {
                            stopThinking();
                            console.log(chalk.red('❌ 请指定知识库名称'));
                            return true;
                        }
                        const targetKb = args[1];
                        const switchResult = await ragService.switchKnowledgeBase(targetKb);
                        stopThinking();
                        if (switchResult.success) {
                            console.log(chalk.green(`\n✅ 已切换到知识库 "${targetKb}"`));
                        } else {
                            console.log(chalk.red(`\n❌ 知识库操作失败：${switchResult.message}`));
                        }
                        break;
                        
                    case 'status':
                        startThinking('获取状态');
                        const status = await ragService.getKnowledgeBaseStatus();
                        const ragStatus = await ragService.getStatus();
                        stopThinking();
                        console.log('\n\n📊 知识库状态:');
                        console.log(`  当前知识库: ${status.currentKnowledgeBase}`);
                        if (status.loadedKnowledgeBases.length > 0) {
                            console.log(`  已加载知识库: ${status.loadedKnowledgeBases.join(', ')}`);
                        }
                        console.log(`  知识库模式: ${status.mode === 'single' ? '单知识库' : '多知识库'}`);
                        console.log(`  RAG 状态: ${status.enabled ? '已启用' : '已禁用'}`);
                        console.log(`  文档数量: ${ragStatus.documentCount}`);
                        console.log(`  分块大小: ${ragStatus.chunkSize}`);
                        console.log(`  块重叠: ${ragStatus.chunkOverlap}`);
                        return true;

                    default:
                        stopThinking();
                        console.log(chalk.red('❌ 未知的知识库操作'));
                }
            } catch (error) {
                stopThinking();
                console.error(chalk.red('\n❌ 知识库操作失败：'), error.message);
            }
            return true;
            
        case 'name':
            const newName = await new Promise(resolve => {
                rl.question(chalk.yellow('👤 请输入你的名字: '), resolve);
            });
            if (newName.trim()) {
                userName = newName.trim();
                await userStore.saveUser(currentUserId, { name: userName });
                console.log(chalk.green('✅ 名字已更新'));
                showWelcome();
            }
            return true;
        case 'init':
            const confirm = await new Promise(resolve => {
                rl.question(chalk.red('⚠️  警告: 此操作将清除所有数据！确定要继续吗？(y/N) '), resolve);
            });
            if (confirm.toLowerCase() === 'y') {
                try {
                    await initService.initialize();
                    // 重置当前会话状态
                    currentUserId = null;
                    currentConversationId = null;
                    userName = null;
                    // 重新初始化用户
                    await initializeUser();
                    clearScreen();
                    console.log(chalk.green('✨ 系统已完全初始化'));
                    showWelcome();
                } catch (error) {
                    console.error(chalk.red('❌ 初始化失败:'), error);
                }
            } else {
                console.log(chalk.yellow('🛑 初始化已取消'));
            }
            return true;
        case 'debug':
            isDebugMode = !isDebugMode;
            console.log(chalk.cyan(`\n🔍 调试模式已${isDebugMode ? '开启' : '关闭'}`));
            process.env.DEBUG = isDebugMode ? 'true' : '';
            return true;
        default:
            const userInput = input;
            startThinking();
            const response = await chat(userInput, currentUserId, currentConversationId);
            stopThinking();
            
            // 显示回答
            if (response.metadata?.mode === 'rag') {
                // 显示知识库匹配信息
                console.log(chalk.cyan('\n=== 📚 知识库匹配信息 ==='));
                console.log(chalk.gray(`📖 使用知识库: ${response.metadata.knowledgeBase}`));
                console.log(chalk.gray(`🎯 匹配文档数: ${response.metadata.matchCount}`));
                
                if (response.metadata.references?.length > 0) {
                    console.log(chalk.gray('\n📊 相关度评分和匹配内容:'));
                    response.metadata.references.forEach(ref => {
                        const score = (ref.score * 100).toFixed(1);
                        const scoreColor = score >= 90 ? 'green' : (score >= 70 ? 'yellow' : 'red');
                        
                        // 显示分数
                        console.log(chalk.gray(`\n文档 ${ref.id}:`));
                        console.log(chalk.gray(`相关度: `) + chalk[scoreColor](`${score}%`));
                        
                        // 显示匹配内容
                        if (ref.excerpt) {
                            console.log(chalk.gray('匹配内容:'));
                            console.log(chalk.gray('----------------------------------------'));
                            console.log(chalk.white(ref.excerpt));
                            console.log(chalk.gray('----------------------------------------'));
                        }
                    });
                }
                
                console.log(chalk.cyan('\n=== 💡 AI 回答 ==='));
            }
            
            // 显示最后一条消息
            const lastMessage = response.messages[response.messages.length - 1];
            console.log('\n' + chalk.green(lastMessage.content) + '\n');
            
            // 更新当前会话ID
            currentConversationId = response.conversationId;
            return true;
    }
}

// 处理 kb status 命令
async function handleKbStatus() {
    const status = await ragService.getKnowledgeBaseStatus();
    const ragStatus = await ragService.getStatus();
    
    console.log('\n\n📊 知识库状态:');
    console.log(`  当前知识库: ${status.currentKnowledgeBase}`);
    if (status.loadedKnowledgeBases.length > 0) {
        console.log(`  已加载知识库: ${status.loadedKnowledgeBases.join(', ')}`);
    }
    console.log(`  知识库模式: ${status.mode === 'single' ? '单知识库' : '多知识库'}`);
    console.log(`  RAG 状态: ${status.enabled ? '已启用' : '已禁用'}`);
    console.log(`  文档数量: ${ragStatus.documentCount}`);
    console.log(`  分块大小: ${ragStatus.chunkSize}`);
    console.log(`  块重叠: ${ragStatus.chunkOverlap}`);
}

// 主循环
async function main() {
    try {
        // 初始化用户
        await initializeUser();
        
        // 创建readline接口
        rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: chalk.blue('👤 你: ')
        });

        clearScreen();
        showWelcome();
        
        // 设置提示符
        rl.prompt();

        // 处理输入
        rl.on('line', async (input) => {
            const shouldContinue = await handleInput(input);
            if (shouldContinue) {
                console.log(''); // 空行
                rl.prompt();
            }
        });

        // 处理关闭
        rl.on('close', () => {
            process.exit(0);
        });
    } catch (error) {
        console.error('Error in main:', error);
        process.exit(1);
    }
}

// 处理程序退出
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n👋 再见！'));
    if (rl) rl.close();
    process.exit(0);
});

// 启动程序
main().catch(error => {
    console.error(chalk.red('\n❌ 程序启动失败:'), error);
    if (rl) rl.close();
    process.exit(1);
});
