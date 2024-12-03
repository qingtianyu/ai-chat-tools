import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { BasicWebScraper } from './BasicWebScraper.js';
import * as cheerio from 'cheerio';

export class SearchTool extends DynamicStructuredTool {
    constructor() {
        super({
            name: "web_search",
            description: "搜索引擎搜索工具",
            schema: z.object({
                query: z.string().describe("搜索关键词"),
                engine: z.enum(["bing", "yandex"]).default("bing").describe("搜索引擎选择"),
                resultCount: z.number().default(5).describe("返回结果数量")
            })
        });

        this.scraper = new BasicWebScraper({
            timeout: 300000
        });
    }

    async _call({ query, engine = "bing", resultCount = 5 }) {
        try {
            const searchUrl = this.getSearchUrl(engine, query);
            console.log('搜索URL:', searchUrl);
            
            const { content } = await this.scraper.scrape(searchUrl);
            const $ = cheerio.load(content);
            
            const results = [];
            
            if (engine === "bing") {
                // Bing 搜索结果解析
                $('#b_results .b_algo').each((i, element) => {
                    if (i >= resultCount) return false;
                    
                    const $element = $(element);
                    const $title = $element.find('h2 a');
                    const $snippet = $element.find('.b_caption p');
                    const $cite = $element.find('cite');
                    
                    const result = {
                        title: $title.text().trim(),
                        url: $title.attr('href'),
                        snippet: $snippet.text().trim(),
                        displayUrl: $cite.text().trim()
                    };
                    
                    if (result.url && result.title) {
                        results.push(result);
                    }
                });
            } else if (engine === "yandex") {
                // Yandex 搜索结果解析
                $('.serp-item').each((i, element) => {
                    if (i >= resultCount) return false;
                    
                    const $element = $(element);
                    const $title = $element.find('.OrganicTitle-Link');
                    const $snippet = $element.find('.OrganicText');
                    
                    const result = {
                        title: $title.text().trim(),
                        url: $title.attr('href'),
                        snippet: $snippet.text().trim()
                    };
                    
                    if (result.url && result.title) {
                        // 确保 URL 是完整的
                        if (!result.url.startsWith('http')) {
                            result.url = 'https://' + result.url.replace(/^\/+/, '');
                        }
                        results.push(result);
                    }
                });
            }
            
            return {
                query,
                engine,
                results,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error("搜索失败:", error);
            throw new Error(`搜索失败: ${error.message}`);
        }
    }
    
    getSearchUrl(engine, query) {
        const encodedQuery = encodeURIComponent(query);
        switch (engine) {
            case "bing":
                return `https://cn.bing.com/search?q=${encodedQuery}`;
            case "yandex":
                return `https://yandex.com/search/?text=${encodedQuery}`;
            default:
                throw new Error(`不支持的搜索引擎: ${engine}`);
        }
    }
}
