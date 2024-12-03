# AI Chat Tools

基于领域驱动设计（DDD）的 AI 聊天工具，支持知识库检索增强生成（RAG）。

## 项目架构

项目采用领域驱动设计（DDD）架构，主要分为以下几层：

### 领域层 (Domain Layer)
- 包含核心业务逻辑和领域模型
- 定义领域服务接口和实现
- 包括用户、对话和知识库等核心概念

### 应用层 (Application Layer)
- 协调领域服务
- 处理应用层面的业务逻辑
- 提供面向用户的功能接口

### 基础设施层 (Infrastructure Layer)
- 提供技术实现细节
- 包括数据库访问、事件管理、日志等
- 实现领域层定义的接口

## 目录结构

```
ai-chat-tools/
├── src/
│   ├── domain/           # 领域层
│   │   ├── models/      # 领域模型
│   │   └── services/    # 领域服务
│   ├── application/     # 应用层
│   │   └── services/    # 应用服务
│   ├── infrastructure/  # 基础设施层
│   │   ├── database/    # 数据库实现
│   │   ├── events/      # 事件管理
│   │   ├── logging/     # 日志服务
│   │   └── di/          # 依赖注入
│   └── config/          # 配置管理
├── data/                # 数据存储
├── logs/                # 日志文件
└── tests/               # 测试文件
```

## 主要特性

- 基于 DDD 的模块化架构
- 支持知识库检索增强生成（RAG）
- 完整的用户会话管理
- 可扩展的事件系统
- 灵活的配置管理
- 完善的日志记录

## 环境要求

- Node.js >= 18.0.0
- SQLite3
- OpenAI API Key

## 快速开始

1. 安装依赖：
```bash
npm install
```

2. 配置环境变量：
```bash
cp .env.example .env
# 编辑 .env 文件，设置必要的环境变量
```

3. 启动应用：
```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

## 开发指南

### 添加新功能

1. 在领域层定义新的模型和服务接口
2. 实现领域服务
3. 在应用层创建相应的应用服务
4. 注册服务到依赖注入容器

### 测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- tests/domain/user.test.js
```

### 代码格式化

```bash
# 格式化代码
npm run format

# 检查代码风格
npm run lint
```

## 部署

1. 构建项目：
```bash
npm run build
```

2. 配置生产环境变量
3. 启动应用：
```bash
NODE_ENV=production npm start
```

## 贡献指南

1. Fork 项目
2. 创建特性分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 许可证

MIT License
