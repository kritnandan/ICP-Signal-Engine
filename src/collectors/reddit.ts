import axios from "axios";
import type { RedditConfig, RawEvent } from "../types.js";
import { BaseCollector } from "./base.js";
import { generateEventId } from "../utils/id.js";

/**
 * Reddit collector.
 *
 * Uses the Reddit OAuth API to pull new posts from supply-chain, logistics,
 * and procurement subreddits. Also hits HackerNews algolia search for
 * relevant threads.
 */
export class RedditCollector extends BaseCollector {
  name = "reddit" as const;

  private config: RedditConfig;

  constructor(config: RedditConfig) {
    super();
    this.config = config;
  }

  async collect(): Promise<RawEvent[]> {
    if (!this.config.enabled) {
      this.log("Skipped – not configured");
      return [];
    }

    const events: RawEvent[] = [];

    const token = await this.authenticate();
    if (!token) {
      this.logError("Authentication failed", "No token received");
      return [];
    }

    for (const sub of this.config.subreddits) {
      try {
        const posts = await this.fetchSubreddit(sub, token);
        events.push(...posts);
      } catch (err) {
        this.logError(`Failed to fetch r/${sub}`, err);
      }
    }

    this.log(`Collected ${events.length} events`);
    return events;
  }

  private async authenticate(): Promise<string | null> {
    try {
      const res = await axios.post(
        "https://www.reddit.com/api/v1/access_token",
        "grant_type=client_credentials",
        {
          auth: {
            username: this.config.clientId!,
            password: this.config.clientSecret!,
          },
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": this.config.userAgent,
          },
        }
      );
      return res.data?.access_token ?? null;
    } catch {
      return null;
    }
  }

  private async fetchSubreddit(
    subreddit: string,
    token: string
  ): Promise<RawEvent[]> {
    const res = await axios.get(
      `https://oauth.reddit.com/r/${subreddit}/new?limit=50`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": this.config.userAgent,
        },
      }
    );

    const posts = res.data?.data?.children ?? [];
    return posts.map(
      (child: Record<string, unknown>): RawEvent => {
        const post = child.data as Record<string, unknown>;
        return {
          id: generateEventId("rd"),
          source: "reddit",
          contentType: "post",
          url: `https://reddit.com${post.permalink}`,
          title: String(post.title ?? ""),
          body: this.truncate(
            String(post.selftext || post.title || "")
          ),
          author: String(post.author ?? ""),
          companyHint: this.extractCompanyHint(
            String(post.title ?? ""),
            String(post.selftext ?? "")
          ),
          tags: [subreddit],
          collectedAt: this.nowISO(),
          publishedAt: post.created_utc
            ? new Date(
                (post.created_utc as number) * 1000
              ).toISOString()
            : undefined,
          metadata: {
            subreddit,
            score: post.score,
            numComments: post.num_comments,
          },
        };
      }
    );
  }

  private extractCompanyHint(
    title: string,
    body: string
  ): string | undefined {
    const combined = `${title} ${body}`;
    // Look for "at [Company]" or "our company [Name]" patterns
    const match = combined.match(
      /(?:at|our company|we at|I work at|working at)\s+([A-Z][\w&. ]+)/i
    );
    return match?.[1]?.trim();
  }
}
