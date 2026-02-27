import type {
  AgentToolDefinition,
  BuyingSignalEvent,
  FeedbackEntry,
  SignalCategory,
  SourcePlatform,
  UserPreferences,
} from "../types.js";
import type { ToolRegistry } from "./tool-registry.js";
import { CompanyMemory } from "../memory/company-memory.js";
import { SignalHistory } from "../memory/signal-history.js";
import { UserPreferencesStore } from "../memory/user-preferences.js";
import { MemoryStore } from "../memory/memory-store.js";
import { join } from "path";
import { logger } from "../utils/logger.js";

const memoryToolDefinitions: AgentToolDefinition[] = [
  {
    name: "read_company_memory",
    description:
      "Read accumulated knowledge about a specific company — signal count, categories, buying stage, notes, and history. Use to answer 'What do we know about X?'",
    input_schema: {
      type: "object",
      properties: {
        companyName: {
          type: "string",
          description: "Company name to look up",
        },
      },
      required: ["companyName"],
    },
    roles: ["orchestrator", "analysis", "memory"],
  },
  {
    name: "write_company_memory",
    description:
      "Record a new signal for a company, updating its accumulated knowledge (signal count, categories, buying stage). Also records signal in history for deduplication.",
    input_schema: {
      type: "object",
      properties: {
        event: {
          type: "object",
          description: "BuyingSignalEvent to record for the company",
        },
      },
      required: ["event"],
    },
    roles: ["orchestrator", "memory"],
  },
  {
    name: "query_signal_history",
    description:
      "Query past signals with filters — by company, category, time range, or get recent signals. Useful for trend detection and deduplication.",
    input_schema: {
      type: "object",
      properties: {
        companyName: {
          type: "string",
          description: "Filter by company name",
        },
        category: {
          type: "string",
          description: "Filter by signal category",
        },
        since: {
          type: "string",
          description: "ISO date — return signals since this date",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default 50)",
        },
        detectTrends: {
          type: "boolean",
          description:
            "If true, return category trend analysis instead of individual signals",
        },
      },
      required: [],
    },
    roles: ["orchestrator", "analysis", "memory"],
  },
  {
    name: "read_user_preferences",
    description:
      "Read the current user preferences — focus industries, focus companies, minimum confidence, preferred sources, output format.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
    roles: ["orchestrator", "analysis", "memory"],
  },
  {
    name: "update_user_preferences",
    description:
      "Update user preferences. Merges with existing preferences.",
    input_schema: {
      type: "object",
      properties: {
        focusIndustries: {
          type: "array",
          items: { type: "string" },
          description: "Industries to focus on",
        },
        focusCompanies: {
          type: "array",
          items: { type: "string" },
          description: "Specific companies to track",
        },
        minConfidence: {
          type: "number",
          description: "Minimum confidence threshold (0-1)",
        },
        preferredSources: {
          type: "array",
          items: { type: "string" },
          description: "Preferred data sources",
        },
        signalCategories: {
          type: "array",
          items: { type: "string" },
          description: "Signal categories of interest",
        },
        outputFormat: {
          type: "string",
          enum: ["detailed", "summary", "minimal"],
          description: "Preferred output format",
        },
      },
      required: [],
    },
    roles: ["orchestrator", "memory"],
  },
  {
    name: "record_feedback",
    description:
      "Record user feedback on a signal — relevant, irrelevant, or partially relevant. Used to calibrate future analysis.",
    input_schema: {
      type: "object",
      properties: {
        eventId: {
          type: "string",
          description: "Event ID the feedback is about",
        },
        feedback: {
          type: "string",
          enum: ["relevant", "irrelevant", "partially_relevant"],
          description: "User's judgment on the signal",
        },
        comment: {
          type: "string",
          description: "Optional comment from the user",
        },
      },
      required: ["eventId", "feedback"],
    },
    roles: ["orchestrator", "memory"],
  },
];

/**
 * Registers memory tools for reading/writing persistent knowledge.
 */
export function registerMemoryTools(
  registry: ToolRegistry,
  memoryDir: string
): void {
  const companyMemory = new CompanyMemory(memoryDir);
  const signalHistory = new SignalHistory(memoryDir);
  const preferencesStore = new UserPreferencesStore(memoryDir);
  const feedbackStore = new MemoryStore<FeedbackEntry>(
    join(memoryDir, "feedback.json")
  );

  // read_company_memory
  registry.register(memoryToolDefinitions[0], async (input) => {
    const companyName = input.companyName as string;
    const company = companyMemory.getCompany(companyName);

    if (!company) {
      return {
        found: false,
        message: `No knowledge found for "${companyName}".`,
      };
    }

    const recentSignals = signalHistory.getByCompany(companyName);
    return {
      found: true,
      company,
      recentSignalCount: recentSignals.length,
      recentSignals: recentSignals.slice(0, 10),
    };
  });

  // write_company_memory
  registry.register(memoryToolDefinitions[1], async (input) => {
    const event = input.event as BuyingSignalEvent;

    // Record in company memory
    const knowledge = companyMemory.recordSignal(event);

    // Record in signal history (with dedup)
    const isNew = signalHistory.record(event);

    return {
      companyName: knowledge.companyName,
      totalSignals: knowledge.signalCount,
      isNewSignal: isNew,
      buyingStage: knowledge.latestBuyingStage,
    };
  });

  // query_signal_history
  registry.register(memoryToolDefinitions[2], async (input) => {
    if (input.detectTrends) {
      const trends = signalHistory.detectTrends();
      return { trends, totalTracked: signalHistory.size };
    }

    const companyName = input.companyName as string | undefined;
    const category = input.category as SignalCategory | undefined;
    const since = input.since as string | undefined;
    const limit = (input.limit as number) || 50;

    let results;

    if (companyName) {
      results = signalHistory.getByCompany(companyName);
    } else if (category) {
      results = signalHistory.getByCategory(category);
    } else if (since) {
      results = signalHistory.getSince(since);
    } else {
      results = signalHistory.getRecent(limit);
    }

    return {
      signals: results.slice(0, limit),
      count: results.length,
      totalTracked: signalHistory.size,
    };
  });

  // read_user_preferences
  registry.register(memoryToolDefinitions[3], async () => {
    return preferencesStore.get();
  });

  // update_user_preferences
  registry.register(memoryToolDefinitions[4], async (input) => {
    const partial: Partial<UserPreferences> = {};
    if (input.focusIndustries)
      partial.focusIndustries = input.focusIndustries as string[];
    if (input.focusCompanies)
      partial.focusCompanies = input.focusCompanies as string[];
    if (input.minConfidence !== undefined)
      partial.minConfidence = input.minConfidence as number;
    if (input.preferredSources)
      partial.preferredSources =
        input.preferredSources as SourcePlatform[];
    if (input.signalCategories)
      partial.signalCategories =
        input.signalCategories as SignalCategory[];
    if (input.outputFormat)
      partial.outputFormat = input.outputFormat as
        | "detailed"
        | "summary"
        | "minimal";

    const updated = preferencesStore.update(partial);
    return { updated, message: "Preferences updated successfully." };
  });

  // record_feedback
  registry.register(memoryToolDefinitions[5], async (input) => {
    const entry: FeedbackEntry = {
      eventId: input.eventId as string,
      feedback: input.feedback as FeedbackEntry["feedback"],
      comment: input.comment as string | undefined,
      timestamp: new Date().toISOString(),
    };

    feedbackStore.append(entry);

    return {
      recorded: true,
      eventId: entry.eventId,
      feedback: entry.feedback,
      totalFeedback: feedbackStore.size,
    };
  });

  logger.info(
    `Registered ${memoryToolDefinitions.length} memory tools`
  );
}
