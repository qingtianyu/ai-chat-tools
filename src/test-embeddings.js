import { OpenAIEmbeddings } from "@langchain/openai";

const API_KEY = "sk-aRUVCBaoLTtfKSfX573c06D3779a41D4B26b00F11dF9Eb37"; // 替换为你的 API key
const BASE_URL = "https://closeproxy.unidtai.com/v1";

async function testEmbeddings() {
    try {
        console.log('创建 OpenAIEmbeddings 实例...');
        const embeddings = new OpenAIEmbeddings({
            openAIApiKey: API_KEY,
            configuration: {
                baseURL: BASE_URL,
                timeout: 30000
            }
        });

        console.log('测试文本嵌入...');
        const result = await embeddings.embedQuery('这是一个测试文本');
        
        console.log('嵌入结果长度:', result.length);
        console.log('嵌入向量前几个数值:', result.slice(0, 5));
        
    } catch (error) {
        console.error('错误:', error);
        if (error.cause) {
            console.error('错误原因:', error.cause);
        }
    }
}

// 运行测试
testEmbeddings();
