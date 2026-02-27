import axios from "axios";
import type { LinkedInConfig, RawEvent, LinkedInContentType } from "../types.js";
import { BaseCollector } from "./base.js";
import { generateEventId } from "../utils/id.js";

/**
 * LinkedIn collector.
 *
 * Uses the LinkedIn Marketing/Community Management API to fetch company posts
 * and the Jobs API for listings. Requires a valid access token with appropriate
 * scopes. If the token is missing, the collector returns an empty array.
 *
 * Extend or replace the API calls with a third-party scraping service
 * (e.g., RapidAPI LinkedIn scraper) if needed.
 */
export class LinkedInCollector extends BaseCollector {
  name = "linkedin" as const;

  private config: LinkedInConfig;
  private baseUrl = "https://api.linkedin.com/v2";

  constructor(config: LinkedInConfig) {
    super();
    this.config = config;
  }

  async collect(): Promise<RawEvent[]> {
    if (!this.config.enabled || !this.config.accessToken) {
      this.log("Skipped – no access token configured");
      return [];
    }

    const events: RawEvent[] = [];

    for (const companyId of this.config.companyIds) {
      try {
        const posts = await this.fetchCompanyPosts(companyId);
        events.push(...posts);
      } catch (err) {
        this.logError(`Failed to fetch posts for ${companyId}`, err);
      }

      try {
        const jobs = await this.fetchJobListings(companyId);
        events.push(...jobs);
      } catch (err) {
        this.logError(`Failed to fetch jobs for ${companyId}`, err);
      }
    }

    this.log(`Collected ${events.length} events`);
    return events;
  }

  private async fetchCompanyPosts(companyId: string): Promise<RawEvent[]> {
    const res = await axios.get(
      `${this.baseUrl}/ugcPosts?q=authors&authors=List(urn:li:organization:${companyId})&count=25`,
      { headers: this.authHeaders() }
    );

    const elements = res.data?.elements ?? [];
    return elements.map(
      (post: Record<string, unknown>): RawEvent =>
        this.mapPost(post, companyId, "company_post")
    );
  }

  private async fetchJobListings(companyId: string): Promise<RawEvent[]> {
    // LinkedIn Jobs API requires partner-level access. This is a placeholder
    // that uses keyword search scoped to the company.
    const keywordQuery = this.config.keywords.join(" OR ");
    const res = await axios.get(
      `${this.baseUrl}/jobSearch?q=companyId&companyId=${companyId}&keywords=${encodeURIComponent(keywordQuery)}&count=25`,
      { headers: this.authHeaders() }
    );

    const elements = res.data?.elements ?? [];
    return elements.map(
      (job: Record<string, unknown>): RawEvent =>
        this.mapPost(job, companyId, "job_listing")
    );
  }

  private mapPost(
    data: Record<string, unknown>,
    companyId: string,
    contentType: LinkedInContentType
  ): RawEvent {
    const specificContent = data.specificContent as
      | Record<string, unknown>
      | undefined;
    const shareContent = specificContent?.[
      "com.linkedin.ugc.ShareContent"
    ] as Record<string, unknown> | undefined;
    const commentary =
      (shareContent?.shareCommentaryV2 as Record<string, unknown>)?.text ??
      (data.title as string) ??
      "";

    return {
      id: generateEventId("li"),
      source: "linkedin",
      contentType,
      url: `https://www.linkedin.com/feed/update/${data.id ?? ""}`,
      title: (data.title as string) ?? undefined,
      body: this.truncate(String(commentary)),
      author: (data.author as string) ?? undefined,
      companyHint: companyId,
      tags: this.config.keywords,
      collectedAt: this.nowISO(),
      publishedAt: data.created
        ? new Date(
            (data.created as Record<string, number>).time
          ).toISOString()
        : undefined,
      metadata: { companyId, raw: data },
    };
  }

  private authHeaders() {
    return {
      Authorization: `Bearer ${this.config.accessToken}`,
      "X-Restli-Protocol-Version": "2.0.0",
    };
  }
}
