# 工具类目录 (Utils)

这个目录包含了领域层使用的各种工具类。

## 文件说明

### idGenerator.js
提供各种ID生成方法：
- UUID生成
- 时间戳ID生成
- 随机ID生成
- 带前缀ID生成
- 特定实体ID生成（用户、会话、消息等）

## 使用示例

```javascript
import { IdGenerator } from './idGenerator.js';

// 生成UUID
const uuid = IdGenerator.generateUUID();

// 生成用户ID
const userId = IdGenerator.generateUserId(); // 格式: usr-uuid

// 生成会话ID
const conversationId = IdGenerator.generateConversationId(); // 格式: conv-uuid

// 生成消息ID
const messageId = IdGenerator.generateMessageId(); // 格式: msg-uuid

// 生成知识库ID
const kbId = IdGenerator.generateKnowledgeBaseId(); // 格式: kb-uuid

// 生成自定义前缀ID
const customId = IdGenerator.generatePrefixedId('custom'); // 格式: custom-uuid
```

## 注意事项

1. ID生成器使用 Node.js 的 `crypto` 模块生成 UUID，确保随机性和唯一性
2. 时间戳ID包含当前时间戳和随机字符串，适用于需要时序的场景
3. 带前缀ID便于识别实体类型，推荐在领域模型中使用
