import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { Configuration } from './Configuration.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../..');

// 加载环境变量
dotenv.config({ path: resolve(rootDir, '.env') });

// 创建配置实例
const config = new Configuration();

// 导出配置实例
export default config;

// 导出配置错误类
export { ConfigurationError } from './Configuration.js';
