import axios from "axios";
import type { TwitterConfig, RawEvent } from "../types.js";
import { BaseCollector } from "./base.js";
import { generateEventId } from "../utils/id.js";

/**
 * Twitter / X collector.
 *
 * Uses the Twitter API v2 recent-search endpoint. Requires a Bearer Token
 * with at least "Basic" access. The collector searches for keyword-based
 * queries and also pulls tweets from specific accounts.
 */
export class TwitterCollector extends BaseCollector {
  name = "twitter" as const;

  private config: TwitterConfig;
  private baseUrl = "https://api.twitter.com/2";

  constructor(config: TwitterConfig) {
    super();
    this.config = config;
  }

  async collect(): Promise<RawEvent[]> {
    if (!this.config.enabled || !this.config.bearerToken) {
      this.log("Skipped – no bearer token configured");
      return [];
    }

    const events: RawEvent[] = [];

    // Search by keywords
    if (this.config.keywords.length > 0) {
      try {
        const keywordEvents = await this.searchByKeywords();
        events.push(...keywordEvents);
      } catch (err) {
        this.logError("Keyword search failed", err);
      }
    }

    // Search by specific accounts
    for (const account of this.config.accounts) {
      try {
        const accountEvents = await this.searchByAccount(account);
        events.push(...accountEvents);
      } catch (err) {
        this.logError(`Account search failed for ${account}`, err);
      }
    }

    this.log(`Collected ${events.length} events`);
    return events;
  }

  private async searchByKeywords(): Promise<RawEvent[]> {
    const query = this.config.keywords
      .map((kw) => `"${kw}"`)
      .join(" OR ");

    const res = await axios.get(`${this.baseUrl}/tweets/search/recent`, {
      headers: this.authHeaders(),
      params: {
        query: `(${query}) -is:retweet lang:en`,
        max_results: 100,
        "tweet.fields": "created_at,author_id,context_annotations,entities",
        expansions: "author_id",
        "user.fields": "name,username,description",
      },
    });

    const tweets = res.data?.data ?? [];
    const users = new Map<string, Record<string, string>>();
    for (const u of res.data?.includes?.users ?? []) {
      users.set(u.id, u);
    }

    return tweets.map(
      (tweet: Record<string, unknown>): RawEvent => {
        const user = users.get(tweet.author_id as string);
        return {
          id: generateEventId("tw"),
          source: "twitter",
          contentType: "tweet",
          url: `https://twitter.com/i/web/status/${tweet.id}`,
          body: this.truncate(String(tweet.text ?? "")),
          author: user?.name ?? (tweet.author_id as string),
          authorRole: user?.description,
          companyHint: this.extractCompanyHint(
            String(tweet.text ?? ""),
            user?.description
          ),
          tags: this.config.keywords,
          collectedAt: this.nowISO(),
          publishedAt: tweet.created_at as string | undefined,
          metadata: { tweetId: tweet.id, authorId: tweet.author_id },
        };
      }
    );
  }

  private async searchByAccount(account: string): Promise<RawEvent[]> {
    const username = account.replace(/^@/, "");
    const query = `from:${username} -is:retweet`;

    const res = await axios.get(`${this.baseUrl}/tweets/search/recent`, {
      headers: this.authHeaders(),
      params: {
        query,
        max_results: 25,
        "tweet.fields": "created_at,author_id",
      },
    });

    const tweets = res.data?.data ?? [];
    return tweets.map(
      (tweet: Record<string, unknown>): RawEvent => ({
        id: generateEventId("tw"),
        source: "twitter",
        contentType: "tweet",
        url: `https://twitter.com/${username}/status/${tweet.id}`,
        body: this.truncate(String(tweet.text ?? "")),
        author: username,
        companyHint: undefined,
        tags: this.config.keywords,
        collectedAt: this.nowISO(),
        publishedAt: tweet.created_at as string | undefined,
        metadata: { tweetId: tweet.id, account: username },
      })
    );
  }

  private extractCompanyHint(
    text: string,
    bio?: string
  ): string | undefined {
    // Simple heuristic: look for @mentions or "at Company" patterns
    const atMatch = text.match(/@(\w+)/);
    if (atMatch) return atMatch[1];
    const bioMatch = bio?.match(/(?:at|@)\s+([A-Z][\w&. ]+)/i);
    if (bioMatch) return bioMatch[1].trim();
    return undefined;
  }

  private authHeaders() {
    return { Authorization: `Bearer ${this.config.bearerToken}` };
  }
}
