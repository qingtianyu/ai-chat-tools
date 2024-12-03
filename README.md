# AI Chat Application with RAG Support

这是一个基于 Node.js 的 AI 聊天应用程序，集成了检索增强生成（RAG）功能。

## 功能特点

- 基于 OpenAI GPT 模型的对话功能
- 支持检索增强生成（RAG）
- 支持多知识库管理
- 灵活的配置系统
- 事件驱动架构

## 目录结构

```
src/
├── services/
│   ├── chat/
│   │   ├── processors/
│   │   │   ├── BaseProcessor.js
│   │   │   ├── RagProcessor.js
│   │   │   └── ...
│   └── rag-service.js
├── config/
│   └── index.js
└── utils/
    ├── OpenAIClient.js
    └── ErrorHandler.js
```

## 安装

1. 克隆仓库：
```bash
git clone <repository-url>
cd ai-chat4
```

2. 安装依赖：
```bash
npm install
```

3. 配置环境变量：
```bash
cp .env.example .env
```
然后编辑 `.env` 文件，填入你的 OpenAI API 密钥和其他配置。

## 配置说明

主要配置项：

- `OPENAI_API_KEY`: OpenAI API 密钥
- `MODEL_NAME`: GPT 模型名称
- `OPENAI_EMBEDDINGS_MODEL`: 嵌入模型名称
- `OPENAI_BASE_URL`: API 基础 URL
- `RAG_CHUNK_SIZE`: 文档分块大小
- `RAG_CHUNK_OVERLAP`: 文档分块重叠大小
- `RAG_MAX_DOCS`: 最大检索文档数
- `RAG_MIN_SCORE`: 最小相关性分数

## 使用方法

1. 启动命令行界面：
```bash
node src/chat-cli2.js
```

2. 与 AI 助手对话：
- 输入问题并按回车
- 输入 "exit" 退出程序

## 开发说明

### 架构设计

- `OpenAIClient`: 统一的 OpenAI API 接口
- `RAGService`: RAG 功能的核心服务
- `RagProcessor`: RAG 消息处理器
- `BaseProcessor`: 处理器基类

### 扩展功能

1. 添加新的处理器：
   - 继承 `BaseProcessor`
   - 实现 `process` 方法
   - 在 `chat-cli2.js` 中注册

2. 添加新的知识库：
   - 使用 `RAGService` 的 API
   - 支持文件和文本形式

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 发起 Pull Request

## 许可证

MIT
