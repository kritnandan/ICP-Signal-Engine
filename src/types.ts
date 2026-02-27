import { z } from "zod";

// ── Source Platforms ──

export type SourcePlatform =
  | "linkedin"
  | "twitter"
  | "reddit"
  | "github"
  | "rss"
  | "hackernews";

export type LinkedInContentType =
  | "company_post"
  | "executive_post"
  | "job_listing";
export type TwitterContentType = "tweet" | "retweet" | "reply";
export type RedditContentType = "post" | "comment";
export type GitHubContentType = "release" | "issue" | "discussion";
export type RSSContentType = "blog_post" | "press_release" | "news_article";

export type ContentType =
  | LinkedInContentType
  | TwitterContentType
  | RedditContentType
  | GitHubContentType
  | RSSContentType;

// ── Raw Event (collected from any source) ──

export interface RawEvent {
  id: string;
  source: SourcePlatform;
  contentType: ContentType;
  url: string;
  title?: string;
  body: string;
  author?: string;
  authorRole?: string;
  companyHint?: string; // best-guess company name from the source
  tags?: string[];
  collectedAt: string; // ISO 8601
  publishedAt?: string; // ISO 8601
  metadata: Record<string, unknown>;
}

// ── ICP (Ideal Customer Profile) ──

export interface ICPCriteria {
  name: string;
  industries: string[];
  minEmployees?: number;
  maxEmployees?: number;
  minRevenue?: number; // USD millions
  maxRevenue?: number;
  geographies?: string[];
  techStack?: string[];
  targetRoles?: string[];
  excludeCompanies?: string[];
  customRules?: ICPCustomRule[];
}

export interface ICPCustomRule {
  field: string;
  operator: "contains" | "equals" | "regex" | "gt" | "lt";
  value: string | number;
}

export interface CompanyMatch {
  companyName: string;
  matchScore: number; // 0-1
  matchedCriteria: string[];
  unmatchedCriteria: string[];
}

// ── Signal Classification ──

export type SignalCategory =
  | "planning_visibility"
  | "inventory_optimization"
  | "procurement_sourcing"
  | "tms_logistics"
  | "wms_warehouse"
  | "s2p_transformation"
  | "erp_migration"
  | "supplier_risk"
  | "network_design"
  | "analytics_reporting"
  | "general_operations";

export type SignalStrength = "strong" | "moderate" | "weak";

export type BuyingStage =
  | "awareness"
  | "research"
  | "evaluation"
  | "decision"
  | "implementation";

export interface SignalClassification {
  isSignal: boolean;
  confidence: number; // 0-1
  category: SignalCategory;
  strength: SignalStrength;
  buyingStage: BuyingStage;
  reasoning: string;
  keywords: string[];
  suggestedActions: string[];
}

// ── Final Structured Output Event ──

export interface BuyingSignalEvent {
  eventId: string;
  timestamp: string; // ISO 8601
  source: {
    platform: SourcePlatform;
    contentType: ContentType;
    url: string;
    author?: string;
    authorRole?: string;
  };
  company: CompanyMatch;
  signal: SignalClassification;
  rawContent: {
    title?: string;
    body: string;
    publishedAt?: string;
  };
  pipeline: {
    collectedAt: string;
    processedAt: string;
    pipelineVersion: string;
  };
}

// ── Zod Schemas for validation ──

export const BuyingSignalEventSchema = z.object({
  eventId: z.string(),
  timestamp: z.string().datetime(),
  source: z.object({
    platform: z.enum([
      "linkedin",
      "twitter",
      "reddit",
      "github",
      "rss",
      "hackernews",
    ]),
    contentType: z.string(),
    url: z.string().url(),
    author: z.string().optional(),
    authorRole: z.string().optional(),
  }),
  company: z.object({
    companyName: z.string(),
    matchScore: z.number().min(0).max(1),
    matchedCriteria: z.array(z.string()),
    unmatchedCriteria: z.array(z.string()),
  }),
  signal: z.object({
    isSignal: z.boolean(),
    confidence: z.number().min(0).max(1),
    category: z.enum([
      "planning_visibility",
      "inventory_optimization",
      "procurement_sourcing",
      "tms_logistics",
      "wms_warehouse",
      "s2p_transformation",
      "erp_migration",
      "supplier_risk",
      "network_design",
      "analytics_reporting",
      "general_operations",
    ]),
    strength: z.enum(["strong", "moderate", "weak"]),
    buyingStage: z.enum([
      "awareness",
      "research",
      "evaluation",
      "decision",
      "implementation",
    ]),
    reasoning: z.string(),
    keywords: z.array(z.string()),
    suggestedActions: z.array(z.string()),
  }),
  rawContent: z.object({
    title: z.string().optional(),
    body: z.string(),
    publishedAt: z.string().optional(),
  }),
  pipeline: z.object({
    collectedAt: z.string(),
    processedAt: z.string(),
    pipelineVersion: z.string(),
  }),
});

// ── Enriched Signal Event (superset of BuyingSignalEvent) ──

export interface EnrichedSignalEvent extends BuyingSignalEvent {
  enrichment: {
    nlSummary?: string;
    companyHistory?: string[];
    relatedSignals?: string[];
    reflectionNotes?: string;
    agentConfidenceAdjustment?: number;
  };
}

// ── Agent Types ──

export type AgentRole = "orchestrator" | "research" | "analysis" | "memory";

export interface AgentPlan {
  goal: string;
  steps: AgentPlanStep[];
  createdAt: string;
}

export interface AgentPlanStep {
  id: string;
  description: string;
  agentRole?: AgentRole;
  toolName?: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  result?: unknown;
}

export interface ReActStep {
  iteration: number;
  thought?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: unknown;
  isError?: boolean;
  timestamp: string;
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  roles?: AgentRole[];
}

export interface AgentRunResult {
  agentRole: AgentRole;
  finalResponse: string;
  steps: ReActStep[];
  tokenUsage: TokenUsage;
  durationMs: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// ── Memory Types ──

export interface CompanyKnowledge {
  companyName: string;
  aliases: string[];
  signalCount: number;
  categories: Record<string, number>;
  latestBuyingStage?: BuyingStage;
  firstSeenAt: string;
  lastSeenAt: string;
  notes: string[];
  signalIds: string[];
}

export interface FeedbackEntry {
  eventId: string;
  feedback: "relevant" | "irrelevant" | "partially_relevant";
  comment?: string;
  timestamp: string;
}

export interface UserPreferences {
  focusIndustries?: string[];
  focusCompanies?: string[];
  minConfidence?: number;
  preferredSources?: SourcePlatform[];
  signalCategories?: SignalCategory[];
  outputFormat?: "detailed" | "summary" | "minimal";
  updatedAt: string;
}

export interface MemoryQuery {
  type: "company" | "signal" | "feedback" | "preference";
  companyName?: string;
  category?: SignalCategory;
  since?: string;
  limit?: number;
}

// ── Conversation Types ──

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ConversationContext {
  turns: ConversationTurn[];
  activeGoal?: string;
  lastAgentResult?: AgentRunResult;
}

// ── Zod Schemas for new types ──

export const CompanyKnowledgeSchema = z.object({
  companyName: z.string(),
  aliases: z.array(z.string()),
  signalCount: z.number(),
  categories: z.record(z.number()),
  latestBuyingStage: z
    .enum(["awareness", "research", "evaluation", "decision", "implementation"])
    .optional(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  notes: z.array(z.string()),
  signalIds: z.array(z.string()),
});

export const FeedbackEntrySchema = z.object({
  eventId: z.string(),
  feedback: z.enum(["relevant", "irrelevant", "partially_relevant"]),
  comment: z.string().optional(),
  timestamp: z.string(),
});

export const UserPreferencesSchema = z.object({
  focusIndustries: z.array(z.string()).optional(),
  focusCompanies: z.array(z.string()).optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  preferredSources: z
    .array(
      z.enum(["linkedin", "twitter", "reddit", "github", "rss", "hackernews"])
    )
    .optional(),
  signalCategories: z
    .array(
      z.enum([
        "planning_visibility",
        "inventory_optimization",
        "procurement_sourcing",
        "tms_logistics",
        "wms_warehouse",
        "s2p_transformation",
        "erp_migration",
        "supplier_risk",
        "network_design",
        "analytics_reporting",
        "general_operations",
      ])
    )
    .optional(),
  outputFormat: z.enum(["detailed", "summary", "minimal"]).optional(),
  updatedAt: z.string(),
});

// ── Collector Interface ──

export interface Collector {
  name: SourcePlatform;
  collect(): Promise<RawEvent[]>;
}

// ── Configuration ──

export interface AgentConfig {
  agentMode: boolean;
  memoryDir: string;
  agentModel: string;
  maxAgentIterations: number;
  enableReflection: boolean;
  enableMemory: boolean;
}

export interface AppConfig {
  anthropicApiKey: string;
  outputDir: string;
  logLevel: string;
  cronSchedule: string;
  icpConfigPath: string;
  signalConfidenceThreshold: number;
  maxEventsPerRun: number;
  agent: AgentConfig;
  collectors: {
    linkedin: LinkedInConfig;
    twitter: TwitterConfig;
    reddit: RedditConfig;
    github: GitHubConfig;
    rss: RSSConfig;
  };
}

export interface LinkedInConfig {
  enabled: boolean;
  accessToken?: string;
  companyIds: string[];
  keywords: string[];
}

export interface TwitterConfig {
  enabled: boolean;
  bearerToken?: string;
  accounts: string[];
  keywords: string[];
}

export interface RedditConfig {
  enabled: boolean;
  clientId?: string;
  clientSecret?: string;
  userAgent: string;
  subreddits: string[];
}

export interface GitHubConfig {
  enabled: boolean;
  token?: string;
  repos: string[];
  keywords: string[];
}

export interface RSSConfig {
  enabled: boolean;
  feeds: string[];
}
