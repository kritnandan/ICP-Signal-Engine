import type { AgentToolDefinition, SourcePlatform } from "../types.js";
import type { AppConfig } from "../types.js";
import type { ToolRegistry } from "./tool-registry.js";
import { createCollectors } from "../collectors/index.js";
import { logger } from "../utils/logger.js";

const collectorToolDefinitions: AgentToolDefinition[] = [
  {
    name: "search_linkedin",
    description:
      "Search LinkedIn for company posts, executive posts, and job listings related to procurement/supply chain. Returns raw events from LinkedIn API.",
    input_schema: {
      type: "object",
      properties: {
        keywords: {
          type: "array",
          items: { type: "string" },
          description:
            "Keywords to search for (overrides default config keywords)",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return",
        },
      },
      required: [],
    },
    roles: ["orchestrator", "research"],
  },
  {
    name: "search_twitter",
    description:
      "Search Twitter/X for tweets about procurement, supply chain, and logistics buying signals. Returns raw events from Twitter API v2.",
    input_schema: {
      type: "object",
      properties: {
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Keywords to search for",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return",
        },
      },
      required: [],
    },
    roles: ["orchestrator", "research"],
  },
  {
    name: "search_reddit",
    description:
      "Search Reddit for posts about procurement, supply chain, and logistics in relevant subreddits. Returns raw events from Reddit API.",
    input_schema: {
      type: "object",
      properties: {
        subreddits: {
          type: "array",
          items: { type: "string" },
          description: "Subreddits to search (overrides defaults)",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return",
        },
      },
      required: [],
    },
    roles: ["orchestrator", "research"],
  },
  {
    name: "search_github",
    description:
      "Search GitHub for releases, issues, and discussions related to supply chain and procurement tools. Returns raw events from GitHub API.",
    input_schema: {
      type: "object",
      properties: {
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Keywords to filter results",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return",
        },
      },
      required: [],
    },
    roles: ["orchestrator", "research"],
  },
  {
    name: "search_rss",
    description:
      "Search RSS feeds and blogs for articles about procurement, supply chain, and logistics. Returns raw events from configured RSS feeds.",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of results to return",
        },
      },
      required: [],
    },
    roles: ["orchestrator", "research"],
  },
  {
    name: "search_hackernews",
    description:
      "Search HackerNews for discussions about procurement, supply chain, logistics, and related technology. Returns raw events from HN Algolia API.",
    input_schema: {
      type: "object",
      properties: {
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Keywords to search for on HackerNews",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return",
        },
      },
      required: [],
    },
    roles: ["orchestrator", "research"],
  },
];

/**
 * Registers all collector tools that wrap existing collectors as agent-callable tools.
 */
export function registerCollectorTools(
  registry: ToolRegistry,
  config: AppConfig
): void {
  const collectors = createCollectors(config);
  const collectorMap = new Map(collectors.map((c) => [c.name, c]));

  // Map tool name → collector source name
  const toolToSource: Record<string, SourcePlatform> = {
    search_linkedin: "linkedin",
    search_twitter: "twitter",
    search_reddit: "reddit",
    search_github: "github",
    search_rss: "rss",
    search_hackernews: "hackernews",
  };

  for (const def of collectorToolDefinitions) {
    const sourceName = toolToSource[def.name];

    registry.register(def, async (input) => {
      // RSS collector handles both RSS and HN
      const collectorName =
        sourceName === "hackernews" ? "rss" : sourceName;
      const collector = collectorMap.get(collectorName);

      if (!collector) {
        return {
          events: [],
          message: `Collector "${sourceName}" is not enabled. Check API keys in .env`,
        };
      }

      try {
        logger.info(`[collector-tool] Running ${def.name}...`);
        let events = await collector.collect();

        // Filter by keywords if provided
        const keywords = input.keywords as string[] | undefined;
        if (keywords && keywords.length > 0) {
          const lowerKeywords = keywords.map((k) => k.toLowerCase());
          events = events.filter((e) => {
            const text =
              `${e.title ?? ""} ${e.body}`.toLowerCase();
            return lowerKeywords.some((kw) => text.includes(kw));
          });
        }

        // Filter HN-specific results when searching hackernews
        if (sourceName === "hackernews") {
          events = events.filter((e) => e.source === "hackernews");
        } else if (sourceName === "rss") {
          events = events.filter((e) => e.source === "rss");
        }

        // Apply limit
        const limit = (input.limit as number) || 50;
        events = events.slice(0, limit);

        return {
          events,
          count: events.length,
          source: sourceName,
        };
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : String(err);
        logger.error(`[collector-tool] ${def.name} failed: ${msg}`);
        return { events: [], error: msg, source: sourceName };
      }
    });
  }

  logger.info(
    `Registered ${collectorToolDefinitions.length} collector tools`
  );
}
