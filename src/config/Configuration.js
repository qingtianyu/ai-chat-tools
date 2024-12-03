import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

/**
 * 配置验证错误
 */
export class ConfigurationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ConfigurationError';
    }
}

/**
 * 配置管理类
 */
export class Configuration {
    constructor() {
        if (!Configuration.instance) {
            Configuration.instance = this;
            this.config = {};
            this.configPath = null;
            this.isInitialized = false;
            this.validators = new Map();
            this.registerDefaultValidators();
        }
        return Configuration.instance;
    }

    /**
     * 注册默认验证器
     * @private
     */
    registerDefaultValidators() {
        this.validators.set('openai.apiKey', (value) => {
            if (!value || typeof value !== 'string' || !value.startsWith('sk-')) {
                throw new ConfigurationError('Invalid OpenAI API key format');
            }
        });

        this.validators.set('security.jwtSecret', (value) => {
            if (!value || typeof value !== 'string' || value.length < 32) {
                throw new ConfigurationError('JWT secret must be at least 32 characters long');
            }
        });

        this.validators.set('rag.maxDocs', (value) => {
            if (!Number.isInteger(value) || value < 1 || value > 20) {
                throw new ConfigurationError('RAG max docs must be between 1 and 20');
            }
        });
    }

    /**
     * 加载环境变量
     * @private
     */
    loadEnvironmentVariables() {
        const envPath = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
        this.configPath = path.resolve(process.cwd(), envPath);
        
        if (!fs.existsSync(this.configPath)) {
            throw new ConfigurationError(`Environment file not found: ${envPath}`);
        }

        const result = dotenv.config({ path: this.configPath });
        if (result.error) {
            throw new ConfigurationError(`Error loading environment variables: ${result.error.message}`);
        }
    }

    /**
     * 初始化配置
     * @private
     */
    initializeConfig() {
        if (this.isInitialized) {
            return;
        }

        try {
            this.loadEnvironmentVariables();

            this.config = {
                app: {
                    name: process.env.APP_NAME || 'AI Chat Tools',
                    version: process.env.APP_VERSION || '1.0.0',
                    environment: process.env.NODE_ENV || 'development',
                    port: parseInt(process.env.PORT) || 3000,
                    host: process.env.HOST || 'localhost'
                },
                openai: {
                    apiKey: process.env.OPENAI_API_KEY,
                    model: process.env.MODEL_NAME || 'gpt-3.5-turbo',
                    embeddingsModel: process.env.OPENAI_EMBEDDINGS_MODEL || 'text-embedding-ada-002',
                    baseUrl: process.env.OPENAI_BASE_URL,
                    maxTokens: parseInt(process.env.MAX_TOKENS) || 2000,
                    temperature: parseFloat(process.env.TEMPERATURE) || 0.7
                },
                rag: {
                    enabled: process.env.RAG_ENABLED === 'true',
                    chunkSize: parseInt(process.env.RAG_CHUNK_SIZE) || 1000,
                    chunkOverlap: parseInt(process.env.RAG_CHUNK_OVERLAP) || 200,
                    maxDocs: parseInt(process.env.RAG_MAX_DOCS) || 5,
                    minScore: parseFloat(process.env.RAG_MIN_SCORE) || 0.7,
                    storageType: process.env.RAG_STORAGE_TYPE || 'memory'
                },
                database: {
                    type: process.env.DB_TYPE || 'sqlite',
                    path: process.env.DB_PATH || ':memory:',
                    url: process.env.DB_URL,
                    options: {
                        useNewUrlParser: true,
                        useUnifiedTopology: true,
                        maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 10,
                        connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 10000
                    }
                },
                security: {
                    jwtSecret: process.env.JWT_SECRET,
                    tokenExpiration: process.env.TOKEN_EXPIRATION || '24h',
                    saltRounds: parseInt(process.env.SALT_ROUNDS) || 10,
                    rateLimiting: {
                        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutes
                        maxRequests: parseInt(process.env.RATE_LIMIT_MAX) || 100
                    }
                },
                logging: {
                    level: process.env.LOG_LEVEL || 'info',
                    file: process.env.LOG_FILE || 'app.log',
                    maxSize: process.env.LOG_MAX_SIZE || '10m',
                    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
                    console: process.env.LOG_CONSOLE !== 'false'
                },
                cache: {
                    type: process.env.CACHE_TYPE || 'memory',
                    ttl: parseInt(process.env.CACHE_TTL) || 3600,
                    maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 1000
                }
            };

            this.validate();
            this.isInitialized = true;
        } catch (error) {
            throw new ConfigurationError(`Configuration initialization failed: ${error.message}`);
        }
    }

    /**
     * 获取配置值
     * @param {string} key 配置键
     * @param {*} defaultValue 默认值
     * @returns {*} 配置值
     */
    get(key, defaultValue = undefined) {
        if (!this.isInitialized) {
            this.initializeConfig();
        }

        const value = key.split('.').reduce((obj, part) => obj && obj[part], this.config);
        return value !== undefined ? value : defaultValue;
    }

    /**
     * 设置配置值
     * @param {string} key 配置键
     * @param {*} value 配置值
     * @throws {ConfigurationError} 如果验证失败
     */
    set(key, value) {
        if (!this.isInitialized) {
            this.initializeConfig();
        }

        // 运行验证器
        const validator = this.validators.get(key);
        if (validator) {
            validator(value);
        }

        const parts = key.split('.');
        const last = parts.pop();
        const obj = parts.reduce((obj, part) => {
            if (!obj[part]) {
                obj[part] = {};
            }
            return obj[part];
        }, this.config);
        obj[last] = value;
    }

    /**
     * 获取所有配置
     * @param {boolean} [masked=true] 是否掩码敏感信息
     * @returns {Object} 配置对象
     */
    getAll(masked = true) {
        if (!this.isInitialized) {
            this.initializeConfig();
        }

        const config = { ...this.config };
        if (masked) {
            if (config.openai?.apiKey) {
                config.openai.apiKey = '***********';
            }
            if (config.security?.jwtSecret) {
                config.security.jwtSecret = '***********';
            }
            if (config.database?.url) {
                config.database.url = '***********';
            }
        }
        return config;
    }

    /**
     * 验证配置是否完整
     * @throws {ConfigurationError} 如果验证失败
     */
    validate() {
        const requiredKeys = [
            'openai.apiKey',
            'database.type',
            'security.jwtSecret'
        ];

        const missingKeys = requiredKeys.filter(key => this.get(key) === undefined);
        if (missingKeys.length > 0) {
            throw new ConfigurationError(`Missing required configuration keys: ${missingKeys.join(', ')}`);
        }

        // 运行所有验证器
        for (const [key, validator] of this.validators) {
            const value = this.get(key);
            if (value !== undefined) {
                validator(value);
            }
        }
    }

    /**
     * 重新加载配置
     */
    reload() {
        this.isInitialized = false;
        this.initializeConfig();
    }

    /**
     * 注册自定义验证器
     * @param {string} key 配置键
     * @param {Function} validator 验证函数
     */
    registerValidator(key, validator) {
        if (typeof validator !== 'function') {
            throw new ConfigurationError('Validator must be a function');
        }
        this.validators.set(key, validator);
    }

    /**
     * 导出配置到文件
     * @param {string} filePath 文件路径
     */
    exportToFile(filePath) {
        const config = this.getAll(false);
        const configString = Object.entries(config)
            .reduce((acc, [key, value]) => {
                if (typeof value === 'object') {
                    Object.entries(value).forEach(([subKey, subValue]) => {
                        acc.push(`${key.toUpperCase()}_${subKey.toUpperCase()}=${subValue}`);
                    });
                } else {
                    acc.push(`${key.toUpperCase()}=${value}`);
                }
                return acc;
            }, [])
            .join('\n');

        fs.writeFileSync(filePath, configString, 'utf8');
    }

    /**
     * 检查配置是否已初始化
     * @returns {boolean}
     */
    isConfigInitialized() {
        return this.isInitialized;
    }
}
