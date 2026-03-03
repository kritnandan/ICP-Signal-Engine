import { readFileSync } from "fs";
import { ApifyClient } from "apify-client";
import type { LinkedInConfig, RawEvent, AppConfig } from "../types.js";
import { BaseCollector } from "./base.js";
import { generateEventId } from "../utils/id.js";

/**
 * LinkedIn collector powered by Apify.
 *
 * Uses the apimaestro/linkedin-posts-search-scraper-no-cookies actor
 * to search LinkedIn posts by keyword — no cookies or login required.
 *
 * Pre-filters posts by:
 * - Excluding posts from excluded titles (HR, Intern, etc.) from icp.json
 * - Enforcing engagement thresholds (minLikes, minComments) from icp.json
 */
export class LinkedInCollector extends BaseCollector {
  name = "linkedin" as const;

  private config: LinkedInConfig;
  private apifyToken: string;
  private apifyClient: ApifyClient | null = null;
  private icpConfigPath: string;

  constructor(config: AppConfig) {
    super();
    this.config = config.collectors.linkedin;
    this.apifyToken = config.apifyApiToken;
    this.icpConfigPath = config.icpConfigPath;

    if (this.apifyToken) {
      this.apifyClient = new ApifyClient({ token: this.apifyToken });
    }
  }

  async collect(): Promise<RawEvent[]> {
    if (!this.config.enabled || !this.apifyClient) {
      this.log("Skipped – no Apify API token configured");
      return [];
    }

    // Load ICP filters at runtime
    const { excludeTitles, minLikes, minComments } = this.loadICPFilters();

    const events: RawEvent[] = [];
    const actorId = this.config.apifyActorId || "apimaestro/linkedin-posts-search-scraper-no-cookies";

    // Use configured keywords if available, otherwise fall back to company IDs as search terms
    const searchTerms = this.config.keywords.length > 0
      ? this.config.keywords
      : this.config.companyIds;

    for (const searchTerm of searchTerms) {
      try {
        this.log(`Searching LinkedIn posts via Apify for keyword: "${searchTerm}"...`);

        const runInput = {
          keywords: searchTerm,
          maxResults: 20, // fetch more so we have enough after filtering
          sortBy: "date"
        };

        const run = await this.apifyClient.actor(actorId).call(runInput);
        this.log(`Apify run finished: ${run.id}. Fetching dataset...`);

        const { items } = await this.apifyClient.dataset(run.defaultDatasetId).listItems();
        this.log(`Got ${items.length} raw posts for keyword "${searchTerm}"`);

        let kept = 0;
        let droppedTitle = 0;
        let droppedEngagement = 0;
        let droppedNoAuthor = 0;

        for (const item of items) {
          const authorTitle = String(item.authorTitle || "").toLowerCase();
          const authorName = String(item.authorName || "").trim();
          const likes = Number(item.likes || item.likeCount || item.reactions || 0);
          const comments = Number(item.commentsCount || item.comments || item.commentCount || 0);

          // Drop posts with no author name (brand/company accounts)
          if (!authorName) {
            droppedNoAuthor++;
            continue;
          }

          // Drop posts from excluded titles (HR, Intern, Coordinator, etc.)
          const isExcluded = excludeTitles.some((t: string) =>
            authorTitle.includes(t.toLowerCase())
          );
          if (isExcluded) {
            droppedTitle++;
            continue;
          }

          // Drop posts below engagement threshold (avoid zero-engagement noise)
          if (likes < minLikes && comments < minComments) {
            droppedEngagement++;
            continue;
          }

          events.push(this.mapApifyResult(item, searchTerm));
          kept++;
        }

        this.log(
          `Keyword "${searchTerm}": kept ${kept}, dropped [no-author: ${droppedNoAuthor}, excluded-title: ${droppedTitle}, low-engagement: ${droppedEngagement}]`
        );
      } catch (err) {
        this.logError(`Failed to fetch posts via Apify for keyword "${searchTerm}"`, err);
      }
    }

    this.log(`Collected ${events.length} total LinkedIn events via Apify`);
    return events;
  }

  private loadICPFilters(): { excludeTitles: string[]; minLikes: number; minComments: number } {
    try {
      const raw = readFileSync(this.icpConfigPath, "utf-8");
      const icp = JSON.parse(raw) as Record<string, unknown>;
      const roleClass = icp.roleClassification as Record<string, unknown> | undefined;
      const engagement = icp.engagementThreshold as Record<string, number> | undefined;
      return {
        excludeTitles: (roleClass?.excludeTitles as string[] | undefined) ?? ["Intern", "Assistant", "Coordinator", "Recruiter", "HR", "Talent"],
        minLikes: engagement?.minLikes ?? 3,
        minComments: engagement?.minComments ?? 1,
      };
    } catch {
      return { excludeTitles: ["Intern", "Assistant", "Coordinator", "Recruiter", "HR", "Talent"], minLikes: 3, minComments: 1 };
    }
  }

  private mapApifyResult(
    data: Record<string, unknown>,
    searchTerm: string
  ): RawEvent {
    const textContent = String(data.text || data.content || data.description || "");
    const url = String(data.url || data.postUrl || `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(searchTerm)}`);
    const author = data.authorName ? String(data.authorName) : undefined;
    const authorRole = data.authorTitle ? String(data.authorTitle) : undefined;

    // Extract real company name from Apify data — try multiple possible field names
    const companyName = String(
      data.authorCompany ||
      data.company ||
      data.companyName ||
      data.organization ||
      data.authorOrganization ||
      ""
    ).trim() || searchTerm; // fallback to keyword only if no company found

    return {
      id: generateEventId("li_apify"),
      source: "linkedin",
      contentType: "company_post",
      url,
      title: author ? `Post by ${author}` : undefined,
      body: this.truncate(textContent),
      author,
      authorRole,
      companyHint: companyName,
      tags: this.config.keywords,
      collectedAt: this.nowISO(),
      publishedAt: data.date ? new Date(String(data.date)).toISOString() : undefined,
      metadata: { searchTerm, rawActorOutput: data },
    };
  }
}
