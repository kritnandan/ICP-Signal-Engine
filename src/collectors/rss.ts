import Parser from "rss-parser";
import type { RSSConfig, RawEvent, RSSContentType } from "../types.js";
import { BaseCollector } from "./base.js";
import { generateEventId } from "../utils/id.js";

/**
 * RSS / Blog / News collector.
 *
 * Parses RSS and Atom feeds from company blogs, news pages, and
 * industry publications. Also supports fetching from HackerNews
 * Algolia search for supply-chain related posts.
 */
export class RSSCollector extends BaseCollector {
  name = "rss" as const;

  private config: RSSConfig;
  private parser: Parser;

  constructor(config: RSSConfig) {
    super();
    this.config = config;
    this.parser = new Parser({
      timeout: 15_000,
      headers: {
        "User-Agent": "ICPSignalMonitor/1.0",
      },
    });
  }

  async collect(): Promise<RawEvent[]> {
    if (!this.config.enabled || this.config.feeds.length === 0) {
      this.log("Skipped – no feeds configured");
      return [];
    }

    const events: RawEvent[] = [];

    for (const feedUrl of this.config.feeds) {
      try {
        const feedEvents = await this.parseFeed(feedUrl);
        events.push(...feedEvents);
      } catch (err) {
        this.logError(`Failed to parse feed ${feedUrl}`, err);
      }
    }

    // Also pull from HackerNews search
    try {
      const hnEvents = await this.fetchHackerNews();
      events.push(...hnEvents);
    } catch (err) {
      this.logError("HackerNews fetch failed", err);
    }

    this.log(`Collected ${events.length} events`);
    return events;
  }

  private async parseFeed(feedUrl: string): Promise<RawEvent[]> {
    const feed = await this.parser.parseURL(feedUrl);

    return (feed.items ?? []).slice(0, 25).map((item): RawEvent => {
      const contentType = this.classifyContentType(
        item.title ?? "",
        item.content ?? ""
      );
      return {
        id: generateEventId("rss"),
        source: "rss",
        contentType,
        url: item.link ?? feedUrl,
        title: item.title,
        body: this.truncate(
          this.stripHtml(item.content || item.contentSnippet || item.title || "")
        ),
        author: item.creator ?? item["dc:creator"] ?? undefined,
        companyHint: this.extractDomain(feedUrl),
        tags: item.categories ?? [],
        collectedAt: this.nowISO(),
        publishedAt: item.isoDate ?? item.pubDate,
        metadata: {
          feedUrl,
          feedTitle: feed.title,
          guid: item.guid,
        },
      };
    });
  }

  private async fetchHackerNews(): Promise<RawEvent[]> {
    const { default: axios } = await import("axios");
    const queries = [
      "supply chain software",
      "procurement platform",
      "logistics technology",
      "warehouse management system",
    ];

    const events: RawEvent[] = [];

    for (const query of queries) {
      try {
        const res = await axios.get(
          `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=10`
        );
        const hits = res.data?.hits ?? [];
        for (const hit of hits) {
          events.push({
            id: generateEventId("hn"),
            source: "hackernews",
            contentType: "post",
            url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
            title: hit.title,
            body: this.truncate(hit.story_text || hit.title || ""),
            author: hit.author,
            companyHint: hit.url ? this.extractDomain(hit.url) : undefined,
            tags: ["hackernews", query],
            collectedAt: this.nowISO(),
            publishedAt: hit.created_at,
            metadata: {
              hnId: hit.objectID,
              points: hit.points,
              numComments: hit.num_comments,
            },
          });
        }
      } catch (err) {
        this.logError(`HN search failed for "${query}"`, err);
      }
    }

    return events;
  }

  private classifyContentType(
    title: string,
    content: string
  ): RSSContentType {
    const combined = `${title} ${content}`.toLowerCase();
    if (
      combined.includes("press release") ||
      combined.includes("announces") ||
      combined.includes("partnership")
    ) {
      return "press_release";
    }
    if (
      combined.includes("news") ||
      combined.includes("report") ||
      combined.includes("industry")
    ) {
      return "news_article";
    }
    return "blog_post";
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  private extractDomain(url: string): string {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace(/^www\./, "").split(".")[0];
    } catch {
      return url;
    }
  }
}
