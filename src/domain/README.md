# Domain Layer

这个目录包含所有的领域模型和核心业务逻辑。

## 目录结构

```
domain/
├── models/           # 领域实体和值对象
│   ├── user/
│   ├── conversation/
│   └── knowledge/
├── services/         # 领域服务
│   ├── user/
│   ├── conversation/
│   └── knowledge/
└── repositories/     # 仓储接口
    ├── user/
    ├── conversation/
    └── knowledge/
```

## 设计原则

1. 领域模型应该是纯粹的业务逻辑，不包含基础设施代码
2. 使用接口定义仓储，具体实现在基础设施层
3. 领域服务处理跨实体的业务逻辑
4. 保持领域模型的不可变性
