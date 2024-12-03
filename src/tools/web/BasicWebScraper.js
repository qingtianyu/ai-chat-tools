import puppeteer from 'puppeteer';

export class BasicWebScraper {
    constructor(config = {}) {
        this.config = {
            timeout: 30000,
            viewport: { width: 1280, height: 800 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            waitForSelector: 'body',
            blockResources: ['image', 'media', 'font', 'stylesheet'],
            extraHeaders: {
                'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            ...config
        };
    }

    async scrape(url) {
        let browser = null;
        try {
            // 启动浏览器
            browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--disable-site-isolation-trials'
                ]
            });

            // 创建新页面
            const page = await browser.newPage();
            await page.setViewport(this.config.viewport);
            await page.setUserAgent(this.config.userAgent);
            await page.setExtraHTTPHeaders(this.config.extraHeaders);

            // 设置请求拦截
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                if (this.config.blockResources.includes(request.resourceType())) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            // 添加错误处理
            page.on('error', error => {
                // 只记录严重错误
                if (error.message.includes('timeout') || error.message.includes('navigation')) {
                    console.error('页面错误:', error);
                }
            });

            // 只输出关键信息，忽略警告
            page.on('console', msg => {
                // 忽略所有控制台输出
            });

            // 设置超时处理
            let timeoutId = setTimeout(() => {
                throw new Error(`页面加载超时: ${url}`);
            }, this.config.timeout);

            console.log('正在加载页面...', url);
            
            // 访问页面
            const response = await page.goto(url, {
                waitUntil: ['domcontentloaded', 'networkidle0'],
                timeout: this.config.timeout
            });

            clearTimeout(timeoutId);

            // 检查响应状态
            if (!response) {
                throw new Error(`无法获取页面响应: ${url}`);
            }

            const status = response.status();
            if (status !== 200) {
                throw new Error(`HTTP ${status} 错误: ${url}`);
            }

            // 等待页面加载
            try {
                await page.waitForSelector(this.config.waitForSelector, {
                    timeout: this.config.timeout
                });
            } catch (error) {
                console.warn(`等待选择器超时: ${this.config.waitForSelector}`);
                // 继续执行，因为某些页面可能没有指定的选择器
            }

            // 获取页面内容
            const content = await page.content();
            const title = await page.title();
            const url_final = page.url(); // 获取最终URL（处理重定向）

            // 检查是否有验证码或登录页面
            const pageText = await page.evaluate(() => document.body.innerText);
            if (pageText.toLowerCase().includes('captcha') || 
                pageText.toLowerCase().includes('robot') ||
                pageText.toLowerCase().includes('blocked')) {
                console.warn('警告: 可能遇到验证码或访问限制');
            }

            return {
                content,
                title,
                url: url_final,
                status,
                headers: response.headers()
            };

        } catch (error) {
            console.error(`抓取页面失败: ${url}`, error);
            throw error;
        } finally {
            if (browser) {
                await browser.close().catch(console.error);
            }
        }
    }

    async call(input) {
        if (!input.url) {
            throw new Error('必须提供 url 参数');
        }
        return await this.scrape(input.url);
    }
}
