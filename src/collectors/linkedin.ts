import { ApifyClient } from "apify-client";
import type { LinkedInConfig, RawEvent, AppConfig } from "../types.js";
import { BaseCollector } from "./base.js";
import { generateEventId } from "../utils/id.js";

/**
 * LinkedIn collector powered by Apify.
 *
 * Uses the apimaestro/linkedin-posts-search-scraper-no-cookies actor
 * to search LinkedIn posts by keyword — no cookies or login required.
 */
export class LinkedInCollector extends BaseCollector {
  name = "linkedin" as const;

  private config: LinkedInConfig;
  private apifyToken: string;
  private apifyClient: ApifyClient | null = null;

  constructor(config: AppConfig) {
    super();
    this.config = config.collectors.linkedin;
    this.apifyToken = config.apifyApiToken;

    if (this.apifyToken) {
      this.apifyClient = new ApifyClient({ token: this.apifyToken });
    }
  }

  async collect(): Promise<RawEvent[]> {
    if (!this.config.enabled || !this.apifyClient) {
      this.log("Skipped – no Apify API token configured");
      return [];
    }

    const events: RawEvent[] = [];
    const actorId = this.config.apifyActorId || "apimaestro/linkedin-posts-search-scraper-no-cookies";

    // Use configured keywords if available, otherwise fall back to company IDs as search terms
    const searchTerms = this.config.keywords.length > 0
      ? this.config.keywords
      : this.config.companyIds;

    for (const searchTerm of searchTerms) {
      try {
        this.log(`Searching LinkedIn posts via Apify for keyword: "${searchTerm}"...`);

        // Input schema for apimaestro/linkedin-posts-search-scraper-no-cookies
        const runInput = {
          keywords: searchTerm,
          maxResults: 10,
          sortBy: "date" // most recent first
        };

        const run = await this.apifyClient.actor(actorId).call(runInput);
        this.log(`Apify run finished: ${run.id}. Fetching dataset...`);

        const { items } = await this.apifyClient.dataset(run.defaultDatasetId).listItems();
        this.log(`Got ${items.length} posts for keyword "${searchTerm}"`);

        for (const item of items) {
          events.push(this.mapApifyResult(item, searchTerm));
        }
      } catch (err) {
        this.logError(`Failed to fetch posts via Apify for keyword "${searchTerm}"`, err);
      }
    }

    this.log(`Collected ${events.length} total LinkedIn events via Apify`);
    return events;
  }

  private mapApifyResult(
    data: Record<string, unknown>,
    searchTerm: string
  ): RawEvent {
    // apimaestro actor returns: text, url, authorName, authorTitle, date, likes, comments
    const textContent = String(data.text || data.content || data.description || "");
    const url = String(data.url || data.postUrl || `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(searchTerm)}`);
    const author = data.authorName ? String(data.authorName) : undefined;
    const authorRole = data.authorTitle ? String(data.authorTitle) : undefined;

    return {
      id: generateEventId("li_apify"),
      source: "linkedin",
      contentType: "company_post",
      url,
      title: author ? `Post by ${author}` : undefined,
      body: this.truncate(textContent),
      author,
      authorRole,
      companyHint: searchTerm,
      tags: this.config.keywords,
      collectedAt: this.nowISO(),
      publishedAt: data.date ? new Date(String(data.date)).toISOString() : undefined,
      metadata: { searchTerm, rawActorOutput: data },
    };
  }
}
