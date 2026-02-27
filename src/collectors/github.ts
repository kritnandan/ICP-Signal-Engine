import axios from "axios";
import type { GitHubConfig, RawEvent, GitHubContentType } from "../types.js";
import { BaseCollector } from "./base.js";
import { generateEventId } from "../utils/id.js";

/**
 * GitHub collector.
 *
 * Monitors releases and issues/discussions in configured repos for
 * supply-chain / logistics / procurement related activity.
 */
export class GitHubCollector extends BaseCollector {
  name = "github" as const;

  private config: GitHubConfig;
  private baseUrl = "https://api.github.com";

  constructor(config: GitHubConfig) {
    super();
    this.config = config;
  }

  async collect(): Promise<RawEvent[]> {
    if (!this.config.enabled) {
      this.log("Skipped – not configured");
      return [];
    }

    const events: RawEvent[] = [];

    for (const repo of this.config.repos) {
      try {
        const releases = await this.fetchReleases(repo);
        events.push(...releases);
      } catch (err) {
        this.logError(`Failed to fetch releases for ${repo}`, err);
      }

      try {
        const issues = await this.fetchIssues(repo);
        events.push(...issues);
      } catch (err) {
        this.logError(`Failed to fetch issues for ${repo}`, err);
      }
    }

    this.log(`Collected ${events.length} events`);
    return events;
  }

  private async fetchReleases(repo: string): Promise<RawEvent[]> {
    const res = await axios.get(
      `${this.baseUrl}/repos/${repo}/releases?per_page=10`,
      { headers: this.authHeaders() }
    );

    const releases = res.data ?? [];
    return releases
      .filter((rel: Record<string, unknown>) =>
        this.matchesKeywords(String(rel.body ?? "") + " " + String(rel.name ?? ""))
      )
      .map(
        (rel: Record<string, unknown>): RawEvent => ({
          id: generateEventId("gh"),
          source: "github",
          contentType: "release" as GitHubContentType,
          url: String(rel.html_url ?? ""),
          title: String(rel.name ?? rel.tag_name ?? ""),
          body: this.truncate(String(rel.body ?? "")),
          author: (rel.author as Record<string, string>)?.login,
          companyHint: repo.split("/")[0],
          tags: this.config.keywords,
          collectedAt: this.nowISO(),
          publishedAt: rel.published_at as string | undefined,
          metadata: { repo, tagName: rel.tag_name, type: "release" },
        })
      );
  }

  private async fetchIssues(repo: string): Promise<RawEvent[]> {
    const since = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const res = await axios.get(
      `${this.baseUrl}/repos/${repo}/issues?state=open&since=${since}&per_page=50`,
      { headers: this.authHeaders() }
    );

    const issues = res.data ?? [];
    return issues
      .filter((issue: Record<string, unknown>) =>
        this.matchesKeywords(
          String(issue.title ?? "") + " " + String(issue.body ?? "")
        )
      )
      .map(
        (issue: Record<string, unknown>): RawEvent => ({
          id: generateEventId("gh"),
          source: "github",
          contentType: (issue.pull_request
            ? "discussion"
            : "issue") as GitHubContentType,
          url: String(issue.html_url ?? ""),
          title: String(issue.title ?? ""),
          body: this.truncate(String(issue.body ?? "")),
          author: (issue.user as Record<string, string>)?.login,
          companyHint: repo.split("/")[0],
          tags: this.config.keywords,
          collectedAt: this.nowISO(),
          publishedAt: issue.created_at as string | undefined,
          metadata: {
            repo,
            issueNumber: issue.number,
            labels: (issue.labels as Array<Record<string, string>>)?.map(
              (l) => l.name
            ),
          },
        })
      );
  }

  private matchesKeywords(text: string): boolean {
    if (this.config.keywords.length === 0) return true;
    const lower = text.toLowerCase();
    return this.config.keywords.some((kw) =>
      lower.includes(kw.toLowerCase())
    );
  }

  private authHeaders() {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
    };
    if (this.config.token) {
      headers.Authorization = `Bearer ${this.config.token}`;
    }
    return headers;
  }
}
