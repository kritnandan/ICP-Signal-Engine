import dotenv from "dotenv";
import type { AppConfig } from "./types.js";

dotenv.config();

function splitEnv(key: string, separator = ","): string[] {
  const val = process.env[key];
  if (!val) return [];
  return val
    .split(separator)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function loadConfig(): AppConfig {
  return {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
    apifyApiToken: process.env.APIFY_API_TOKEN || "",
    apolloApiKey: process.env.APOLLO_API_KEY || "",
    outputDir: process.env.OUTPUT_DIR || "./output",
    logLevel: process.env.LOG_LEVEL || "info",
    cronSchedule: process.env.CRON_SCHEDULE || "0 */4 * * *",
    icpConfigPath: process.env.ICP_CONFIG_PATH || "./config/icp.json",
    signalConfidenceThreshold: parseFloat(
      process.env.SIGNAL_CONFIDENCE_THRESHOLD || "0.6"
    ),
    maxEventsPerRun: parseInt(process.env.MAX_EVENTS_PER_RUN || "500", 10),
    agent: {
      agentMode: process.env.AGENT_MODE === "true",
      memoryDir: process.env.MEMORY_DIR || "./data/memory",
      agentModel: process.env.AGENT_MODEL || "claude-sonnet-4-6",
      maxAgentIterations: parseInt(
        process.env.MAX_AGENT_ITERATIONS || "15",
        10
      ),
      enableReflection: process.env.ENABLE_REFLECTION !== "false",
      enableMemory: process.env.ENABLE_MEMORY !== "false",
    },
    collectors: {
      linkedin: {
        enabled: !!process.env.LINKEDIN_ACCESS_TOKEN || !!process.env.APIFY_API_TOKEN,
        accessToken: process.env.LINKEDIN_ACCESS_TOKEN,
        apifyActorId: process.env.APIFY_ACTOR_ID || "anchor/linkedin-profile-scraper",
        companyIds: splitEnv("LINKEDIN_COMPANY_IDS"),
        keywords: splitEnv("LINKEDIN_KEYWORDS"),
      },
      twitter: {
        enabled: !!process.env.TWITTER_BEARER_TOKEN,
        bearerToken: process.env.TWITTER_BEARER_TOKEN,
        accounts: splitEnv("TWITTER_ACCOUNTS"),
        keywords: splitEnv("TWITTER_KEYWORDS"),
      },
      reddit: {
        enabled: !!process.env.REDDIT_CLIENT_ID,
        clientId: process.env.REDDIT_CLIENT_ID,
        clientSecret: process.env.REDDIT_CLIENT_SECRET,
        userAgent:
          process.env.REDDIT_USER_AGENT || "icp-signal-monitor/1.0",
        subreddits: splitEnv("REDDIT_SUBREDDITS"),
      },
      github: {
        enabled: !!process.env.GITHUB_TOKEN,
        token: process.env.GITHUB_TOKEN,
        repos: splitEnv("GITHUB_REPOS"),
        keywords: splitEnv("GITHUB_KEYWORDS"),
      },
      rss: {
        enabled: splitEnv("RSS_FEEDS").length > 0,
        feeds: splitEnv("RSS_FEEDS"),
      },
    },
  };
}
