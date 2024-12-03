import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { BasicWebScraper } from './BasicWebScraper.js';

export class WebScraperTool extends DynamicStructuredTool {
    constructor() {
        super({
            name: "web_scraper",
            description: "网页内容抓取工具",
            schema: z.object({
                url: z.string().describe("要抓取的网页URL")
            })
        });

        this.scraper = new BasicWebScraper({
            timeout: 30000
        });
    }

    async _call({ url }) {
        try {
            const result = await this.scraper.scrape(url);
            return {
                url,
                content: result.content,
                title: result.title,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error("网页抓取失败:", error);
            throw new Error(`网页抓取失败: ${error.message}`);
        }
    }

    async scrapeUrl(url) {
        return this._call({ url });
    }
}
