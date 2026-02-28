import type { AppConfig, Collector } from "../types.js";
import { LinkedInCollector } from "./linkedin.js";
import { TwitterCollector } from "./twitter.js";
import { RedditCollector } from "./reddit.js";
import { GitHubCollector } from "./github.js";
import { RSSCollector } from "./rss.js";

export function createCollectors(config: AppConfig): Collector[] {
  const collectors: Collector[] = [];

  if (config.collectors.linkedin.enabled) {
    collectors.push(new LinkedInCollector(config));
  }
  if (config.collectors.twitter.enabled) {
    collectors.push(new TwitterCollector(config.collectors.twitter));
  }
  if (config.collectors.reddit.enabled) {
    collectors.push(new RedditCollector(config.collectors.reddit));
  }
  if (config.collectors.github.enabled) {
    collectors.push(new GitHubCollector(config.collectors.github));
  }
  if (config.collectors.rss.enabled) {
    collectors.push(new RSSCollector(config.collectors.rss));
  }

  return collectors;
}

export {
  LinkedInCollector,
  TwitterCollector,
  RedditCollector,
  GitHubCollector,
  RSSCollector,
};
