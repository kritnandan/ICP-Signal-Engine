import { ApifyClient } from "apify-client";
import type { LinkedInConfig, RawEvent, AppConfig } from "../types.js";
import { BaseCollector } from "./base.js";
import { generateEventId } from "../utils/id.js";

/**
 * LinkedIn collector powered by Apify.
 *
 * Scrapes LinkedIn public data safely using Apify actors instead of
 * the official blocked API.
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
    const actorId = this.config.apifyActorId || "anchor/linkedin-profile-scraper";

    for (const companyId of this.config.companyIds) {
      try {
        this.log(`Running Apify Actor ${actorId} for company: ${companyId}...`);

        // Prepare actor input 
        const runInput = {
          urls: [`https://www.linkedin.com/company/${companyId}/`],
          deepScrape: true,
          limit: 10
        };

        // Call Apify 
        const run = await this.apifyClient.actor(actorId).call(runInput);
        this.log(`Apify run finished: ${run.id}. Fetching dataset...`);

        const { items } = await this.apifyClient.dataset(run.defaultDatasetId).listItems();

        for (const item of items) {
          events.push(this.mapApifyResult(item, companyId));
        }
      } catch (err) {
        this.logError(`Failed to fetch posts via Apify for ${companyId}`, err);
      }
    }

    this.log(`Collected ${events.length} target events via Apify`);
    return events;
  }

  private mapApifyResult(
    data: Record<string, unknown>,
    companyId: string
  ): RawEvent {
    // We map generic Apify scraping JSON to our pipeline RawEvent
    const textContent = String(data.text || data.about || data.description || "");
    const url = String(data.url || `https://www.linkedin.com/company/${companyId}`);

    return {
      id: generateEventId("li_apify"),
      source: "linkedin",
      contentType: "company_post", // default generic classification
      url: url,
      title: data.title ? String(data.title) : undefined,
      body: this.truncate(textContent),
      author: data.authorName ? String(data.authorName) : undefined,
      companyHint: companyId,
      tags: this.config.keywords,
      collectedAt: this.nowISO(),
      publishedAt: data.date ? new Date(String(data.date)).toISOString() : undefined,
      metadata: { companyId, rawActorParams: data },
    };
  }
}

