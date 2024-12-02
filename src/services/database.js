import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class DatabaseService {
    constructor() {
        this.prisma = prisma;
    }

    // 初始化数据库连接
    async initialize() {
        try {
            await this.prisma.$connect();
            console.log('Database connected successfully');
        } catch (error) {
            console.error('Failed to connect to database:', error);
            throw error;
        }
    }

    // 关闭数据库连接
    async close() {
        try {
            await this.prisma.$disconnect();
            console.log('Database disconnected successfully');
        } catch (error) {
            console.error('Failed to disconnect from database:', error);
            throw error;
        }
    }

    // 创建新对话
    async createConversation(userId, userName = 'default') {
        const conversation = await this.prisma.conversation.create({
            data: {
                userId,
                metadata: JSON.stringify({ userName })
            }
        });
        return conversation.id;
    }

    // 添加消息到对话
    async addMessage(conversationId, { role, content, isSummary = false, metadata = null }) {
        return await this.prisma.message.create({
            data: {
                role,
                content,
                isSummary,
                metadata: metadata ? JSON.stringify(metadata) : null,
                conversation: {
                    connect: {
                        id: conversationId
                    }
                }
            }
        });
    }

    // 获取对话的所有消息
    async getConversationMessages(conversationId) {
        return await this.prisma.message.findMany({
            where: {
                conversationId
            },
            orderBy: {
                createdAt: 'asc'
            }
        });
    }

    // 获取对话的消息数量
    async getMessageCount(conversationId) {
        return await this.prisma.message.count({
            where: {
                conversationId
            }
        });
    }

    // 更新对话摘要
    async updateConversationSummary(conversationId, summary) {
        return await this.prisma.conversation.update({
            where: {
                id: conversationId
            },
            data: {
                summary
            }
        });
    }

    // 获取用户的所有对话
    async getUserConversations(userId, limit = 10) {
        const conversations = await this.prisma.conversation.findMany({
            where: {
                userId
            },
            orderBy: {
                updatedAt: 'desc'
            },
            take: limit,
            include: {
                messages: {
                    orderBy: {
                        createdAt: 'asc'
                    },
                    take: 1
                }
            }
        });

        // 获取每个对话的最后一条消息
        const conversationsWithLastMessage = await Promise.all(
            conversations.map(async (conv) => {
                const lastMessage = await this.prisma.message.findFirst({
                    where: {
                        conversationId: conv.id
                    },
                    orderBy: {
                        createdAt: 'desc'
                    }
                });

                return {
                    ...conv,
                    firstMessage: conv.messages[0]?.content || null,
                    lastMessage: lastMessage?.content || null,
                    messageCount: await this.prisma.message.count({
                        where: {
                            conversationId: conv.id
                        }
                    })
                };
            })
        );

        return conversationsWithLastMessage;
    }

    // 获取单个对话
    async getConversation(conversationId) {
        return await this.prisma.conversation.findUnique({
            where: {
                id: conversationId
            },
            include: {
                messages: {
                    orderBy: {
                        createdAt: 'asc'
                    }
                }
            }
        });
    }

    // 获取对话详情
    async getConversationDetail(conversationId) {
        return await this.prisma.conversation.findUnique({
            where: {
                id: conversationId
            }
        });
    }

    // 删除对话及其所有消息
    async deleteConversation(conversationId) {
        return await this.prisma.conversation.delete({
            where: {
                id: conversationId
            }
        });
    }

    // 清理旧消息，保留最新的N条
    async cleanOldMessages(conversationId, keepCount) {
        const messages = await this.prisma.message.findMany({
            where: {
                conversationId
            },
            orderBy: {
                createdAt: 'desc'
            },
            skip: keepCount
        });

        if (messages.length > 0) {
            await this.prisma.message.deleteMany({
                where: {
                    id: {
                        in: messages.map(m => m.id)
                    }
                }
            });
        }
    }

    // 将消息标记为摘要
    async markMessageAsSummary(messageId) {
        return await this.prisma.message.update({
            where: {
                id: messageId
            },
            data: {
                isSummary: true
            }
        });
    }

    // 获取最近的消息
    async getRecentMessages(conversationId, limit = 5) {
        return await this.prisma.message.findMany({
            where: {
                conversationId
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: limit
        });
    }

    // 获取第一条消息
    async getFirstMessage(conversationId) {
        return await this.prisma.message.findFirst({
            where: {
                conversationId
            },
            orderBy: {
                createdAt: 'asc'
            }
        });
    }

    // 获取最后一条消息
    async getLastMessage(conversationId) {
        return await this.prisma.message.findFirst({
            where: {
                conversationId
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }
}
