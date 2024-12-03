import readline from 'readline';
import ChatService from './services/chat/ChatService.js';
import chalk from 'chalk';

// 初始化服务
const chatService = ChatService.getInstance();
const userId = 'cli-user';
let conversationId = null;

// 等待初始化完成
await new Promise(resolve => setTimeout(resolve, 1000));

// 创建命令行接口
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// 思考动画帧
const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let frameIndex = 0;
let thinkingAnimation = null;

// 显示思考动画
function showThinking(message = '思考中') {
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
    }, 150);
}

// 停止思考动画
function stopThinking() {
    if (thinkingAnimation) {
        clearInterval(thinkingAnimation);
        thinkingAnimation = null;
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
    }
}

// 清屏函数
function clearScreen() {
    console.clear();
}

// 显示欢迎信息
function showWelcome() {
    console.log(chalk.blue('\n=== 🤖 AI 智能助手 ==='));
    console.log('\n📝 可用命令:');
    console.log(chalk.yellow('- new:   ✨ 开始新对话'));
    console.log(chalk.yellow('- clear: 🧹 清除屏幕'));
    console.log(chalk.yellow('- exit:  👋 退出程序'));
    console.log('');
}

// 处理用户输入
async function handleInput(input) {
    if (!input.trim()) return;

    const command = input.toLowerCase().trim();

    switch (command) {
        case 'exit':
        case 'quit':
            console.log(chalk.yellow('\n👋 再见！'));
            rl.close();
            process.exit(0);
            break;

        case 'clear':
            clearScreen();
            showWelcome();
            break;

        case 'new':
            conversationId = null;
            console.log(chalk.green('\n✨ 已开始新对话'));
            break;

        default:
            try {
                showThinking();
                const response = await chatService.chat(input, userId, conversationId);
                stopThinking();

                if (response.success) {
                    // 更新会话ID
                    conversationId = response.conversationId;
                    // 显示AI回复
                    const assistantMessage = response.messages[response.messages.length - 1].content;
                    console.log('\nAI:', assistantMessage);
                } else {
                    console.error(chalk.red('\n❌ 错误:'), response.error || '未知错误');
                }
            } catch (error) {
                stopThinking();
                console.error(chalk.red('\n❌ 错误:'), error.message);
            }
    }
}

// 主循环
async function main() {
    try {
        // 显示欢迎信息
        showWelcome();

        // 开始交互循环
        const askQuestion = () => {
            rl.question(chalk.blue('你: '), async (input) => {
                await handleInput(input);
                console.log(); // 空行
                askQuestion();
            });
        };

        askQuestion();
    } catch (error) {
        console.error(chalk.red('程序启动失败:'), error.message);
        process.exit(1);
    }
}

// 处理程序退出
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n👋 再见！'));
    if (rl) rl.close();
    process.exit(0);
});

// 启动主程序
main().catch(console.error);
