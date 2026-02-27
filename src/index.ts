// ── Configuration ──
export { loadConfig } from "./config.js";

// ── Types ──
export type {
  BuyingSignalEvent,
  EnrichedSignalEvent,
  RawEvent,
  SignalClassification,
  CompanyMatch,
  ICPCriteria,
  AppConfig,
  AgentConfig,
  SourcePlatform,
  SignalCategory,
  SignalStrength,
  BuyingStage,
  AgentRole,
  AgentRunResult,
  CompanyKnowledge,
  FeedbackEntry,
  UserPreferences,
  ConversationTurn,
  ConversationContext,
} from "./types.js";
export {
  BuyingSignalEventSchema,
  CompanyKnowledgeSchema,
  FeedbackEntrySchema,
  UserPreferencesSchema,
} from "./types.js";

// ── Legacy Pipeline ──
export { Pipeline } from "./pipeline/pipeline.js";
export type { PipelineResult } from "./pipeline/pipeline.js";
export { Scheduler } from "./pipeline/scheduler.js";

// ── Engines ──
export { ICPMatcher } from "./engines/icp-matcher.js";
export { SignalClassifier } from "./engines/signal-classifier.js";

// ── Output ──
export { OutputWriter } from "./output/writer.js";
export { SummaryGenerator } from "./output/summary-generator.js";

// ── Collectors ──
export { createCollectors } from "./collectors/index.js";

// ── Agents ──
export { OrchestratorAgent } from "./agents/orchestrator.js";
export { ResearchAgent } from "./agents/research.js";
export { AnalysisAgent } from "./agents/analysis.js";
export { MemoryAgent } from "./agents/memory-agent.js";
export { BaseAgent } from "./agents/base-agent.js";

// ── Tools ──
export { ToolRegistry, createToolRegistry } from "./tools/tool-registry.js";
export { registerCollectorTools } from "./tools/collector-tools.js";
export { registerAnalysisTools } from "./tools/analysis-tools.js";
export { registerOutputTools } from "./tools/output-tools.js";
export { registerMemoryTools } from "./tools/memory-tools.js";

// ── Memory ──
export { MemoryStore } from "./memory/memory-store.js";
export { CompanyMemory } from "./memory/company-memory.js";
export { SignalHistory } from "./memory/signal-history.js";
export { UserPreferencesStore } from "./memory/user-preferences.js";

// ── Conversation ──
export { SignalREPL } from "./conversation/repl.js";
export { OnboardingWizard } from "./conversation/onboarding.js";

// ── Utils ──
export { CostTracker } from "./utils/cost-tracker.js";
