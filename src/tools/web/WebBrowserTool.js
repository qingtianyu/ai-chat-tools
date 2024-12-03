import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as cheerio from 'cheerio';
import { BasicWebScraper } from './BasicWebScraper.js';

export class WebBrowserCore {
    constructor(config = {}) {
        this.config = {
            timeout: 30000,
            ...config
        };
        this.scraper = new BasicWebScraper({
            timeout: this.config.timeout
        });
    }

    async extractContent($) {
        // 移除不需要的元素
        $('script').remove();
        $('style').remove();
        $('nav').remove();
        $('header').remove();
        $('footer').remove();
        $('.sidebar').remove();
        $('.menu').remove();
        $('.ads').remove();

        // 提取代码块
        const codeBlocks = [];
        $('pre code, .code-block, .highlight code').each((_, element) => {
            const $code = $(element);
            const language = $code.attr('class')?.match(/language-(\w+)/)?.[1] || 
                           $code.parent().attr('class')?.match(/language-(\w+)/)?.[1] || 
                           'text';
            codeBlocks.push({
                language,
                code: $code.text().trim(),
                context: $code.parent().prev().text().trim() // 尝试获取代码块上方的说明文本
            });
        });

        // 获取主要内容
        const mainSelectors = ['main', 'article', '.content', '.main', '#content', '#main'];
        let mainContent = '';

        for (const selector of mainSelectors) {
            const element = $(selector);
            if (element.length > 0) {
                mainContent = element.text().trim();
                break;
            }
        }

        // 如果没有找到主要内容区域，则使用 body
        if (!mainContent) {
            mainContent = $('body').text().trim();
        }

        return {
            content: mainContent,
            codeBlocks
        };
    }

    async extractLinks($, baseUrl) {
        const links = [];
        $('a[href]').each((_, element) => {
            const $link = $(element);
            const href = $link.attr('href');
            const text = $link.text().trim();
            
            try {
                const url = new URL(href, baseUrl);
                links.push({
                    url: url.href,
                    text: text || url.href,
                    isExternal: url.origin !== new URL(baseUrl).origin
                });
            } catch (error) {
                console.warn(`Invalid URL: ${href}`);
            }
        });
        return links;
    }

    async call({ url }) {
        const result = await this.scraper.scrape(url);
        const $ = cheerio.load(result.content);
        
        // 提取页面信息
        const title = $('title').text().trim() || $('h1').first().text().trim();
        const description = $('meta[name="description"]').attr('content') || 
                          $('meta[property="og:description"]').attr('content') || '';
        
        // 提取内容和代码块
        const { content, codeBlocks } = await this.extractContent($);
        
        // 提取链接
        const links = await this.extractLinks($, url);

        return {
            url,
            title,
            description,
            content,
            codeBlocks,
            links,
            timestamp: new Date().toISOString()
        };
    }
}

export class WebBrowserTool extends DynamicStructuredTool {
    constructor({ model }) {
        if (!model) {
            throw new Error('WebBrowserTool requires a model instance');
        }

        super({
            name: "web_browser",
            description: "用于访问和浏览网页的工具。可以提取网页内容、代码块、链接等信息，并生成内容摘要。",
            schema: z.object({
                url: z.string().describe("要访问的网页URL"),
            })
        });

        this.model = model;
        this.browser = new WebBrowserCore();
    }

    async _call({ url }) {
        try {
            const result = await this.browser.call({ url });

            // 使用传入的模型生成摘要
            const response = await this.model.invoke([
                {
                    role: "system",
                    content: "你是一个网页内容分析助手。请简要总结网页的主要内容，重点关注最重要的信息。"
                },
                {
                    role: "user",
                    content: result.content
                }
            ]);

            return {
                url: result.url,
                summary: response.content,
                title: result.title,
                description: result.description,
                links: result.links,
                timestamp: result.timestamp,
                internalLinks: result.links.filter(link => !link.isExternal),
                externalLinks: result.links.filter(link => link.isExternal),
                codeBlocks: result.codeBlocks
            };
        } catch (error) {
            console.error("网页访问错误：", error);
            return `访问网页失败: ${error.message}`;
        }
    }
}
