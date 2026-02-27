import { describe, it, expect, vi } from "vitest";
import { ToolRegistry } from "../../src/tools/tool-registry.js";
import { registerCollectorTools } from "../../src/tools/collector-tools.js";
import type { AppConfig } from "../../src/types.js";

// Mock the collectors
vi.mock("../../src/collectors/index.js", () => ({
  createCollectors: vi.fn(() => [
    {
      name: "rss",
      collect: vi.fn().mockResolvedValue([
        {
          id: "rss_001",
          source: "rss",
          contentType: "blog_post",
          url: "https://example.com/post",
          title: "Supply chain trends in TMS",
          body: "Major developments in transportation management systems...",
          collectedAt: new Date().toISOString(),
          metadata: {},
        },
        {
          id: "hn_001",
          source: "hackernews",
          contentType: "news_article",
          url: "https://news.ycombinator.com/item?id=123",
          title: "New procurement platform launch",
          body: "A new procurement technology platform...",
          collectedAt: new Date().toISOString(),
          metadata: {},
        },
      ]),
    },
  ]),
}));

function createTestConfig(): AppConfig {
  return {
    anthropicApiKey: "test-key",
    outputDir: "./test-output",
    logLevel: "error",
    cronSchedule: "0 */4 * * *",
    icpConfigPath: "./config/icp.json",
    signalConfidenceThreshold: 0.6,
    maxEventsPerRun: 100,
    agent: {
      agentMode: true,
      memoryDir: "./test-data/memory",
      agentModel: "claude-sonnet-4-6",
      maxAgentIterations: 5,
      enableReflection: true,
      enableMemory: true,
    },
    collectors: {
      linkedin: { enabled: false, companyIds: [], keywords: [] },
      twitter: { enabled: false, accounts: [], keywords: [] },
      reddit: {
        enabled: false,
        userAgent: "test",
        subreddits: [],
      },
      github: { enabled: false, repos: [], keywords: [] },
      rss: { enabled: true, feeds: ["https://example.com/feed"] },
    },
  };
}

describe("Collector Tools", () => {
  it("registers all 6 collector tools", () => {
    const registry = new ToolRegistry();
    const config = createTestConfig();

    registerCollectorTools(registry, config);

    const names = registry.listNames();
    expect(names).toContain("search_linkedin");
    expect(names).toContain("search_twitter");
    expect(names).toContain("search_reddit");
    expect(names).toContain("search_github");
    expect(names).toContain("search_rss");
    expect(names).toContain("search_hackernews");
  });

  it("search_rss returns RSS events only", async () => {
    const registry = new ToolRegistry();
    const config = createTestConfig();
    registerCollectorTools(registry, config);

    const result = (await registry.execute("search_rss", {})) as {
      events: Array<{ source: string }>;
      count: number;
    };

    expect(result.count).toBe(1);
    expect(result.events[0].source).toBe("rss");
  });

  it("search_hackernews returns HN events only", async () => {
    const registry = new ToolRegistry();
    const config = createTestConfig();
    registerCollectorTools(registry, config);

    const result = (await registry.execute("search_hackernews", {})) as {
      events: Array<{ source: string }>;
      count: number;
    };

    expect(result.count).toBe(1);
    expect(result.events[0].source).toBe("hackernews");
  });

  it("filters by keywords when provided", async () => {
    const registry = new ToolRegistry();
    const config = createTestConfig();
    registerCollectorTools(registry, config);

    const result = (await registry.execute("search_rss", {
      keywords: ["TMS"],
    })) as { events: Array<{ title: string }>; count: number };

    expect(result.count).toBe(1);
    expect(result.events[0].title).toContain("TMS");
  });

  it("returns empty result for disabled collector", async () => {
    const registry = new ToolRegistry();
    const config = createTestConfig();
    registerCollectorTools(registry, config);

    const result = (await registry.execute("search_linkedin", {})) as {
      events: unknown[];
      message: string;
    };

    expect(result.events).toEqual([]);
    expect(result.message).toContain("not enabled");
  });
});
