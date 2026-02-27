import type { AgentToolDefinition, RawEvent } from "../types.js";
import type { AppConfig } from "../types.js";
import type { ToolRegistry } from "./tool-registry.js";
import { ICPMatcher } from "../engines/icp-matcher.js";
import { SignalClassifier } from "../engines/signal-classifier.js";
import { logger } from "../utils/logger.js";

const analysisToolDefinitions: AgentToolDefinition[] = [
  {
    name: "match_icp_profile",
    description:
      "Match a raw event against the Ideal Customer Profile (ICP). Returns a company match score (0-1) with matched/unmatched criteria. Use this to determine if a signal is from a target company.",
    input_schema: {
      type: "object",
      properties: {
        event: {
          type: "object",
          description: "A raw event object to match against ICP criteria",
        },
      },
      required: ["event"],
    },
    roles: ["orchestrator", "analysis"],
  },
  {
    name: "classify_signal",
    description:
      "Classify a single raw event as a buying signal using Claude AI. Returns signal category, strength, confidence, buying stage, reasoning, and suggested actions.",
    input_schema: {
      type: "object",
      properties: {
        event: {
          type: "object",
          description: "A raw event object to classify",
        },
      },
      required: ["event"],
    },
    roles: ["orchestrator", "analysis"],
  },
  {
    name: "classify_batch",
    description:
      "Classify a batch of raw events as buying signals. More efficient than classifying one at a time. Returns a map of event IDs to classification results.",
    input_schema: {
      type: "object",
      properties: {
        events: {
          type: "array",
          items: { type: "object" },
          description: "Array of raw event objects to classify",
        },
        concurrency: {
          type: "number",
          description:
            "Number of concurrent classification calls (default 5)",
        },
      },
      required: ["events"],
    },
    roles: ["orchestrator", "analysis"],
  },
  {
    name: "cross_reference_signals",
    description:
      "Cross-reference multiple signals to find patterns — same company across sources, related categories, or correlated timing. Returns grouped and annotated results.",
    input_schema: {
      type: "object",
      properties: {
        signals: {
          type: "array",
          items: { type: "object" },
          description:
            "Array of classified signal events to cross-reference",
        },
      },
      required: ["signals"],
    },
    roles: ["analysis"],
  },
  {
    name: "reflect_on_quality",
    description:
      "Reflection tool: review a set of classified signals and check for false positives, miscalibrated confidence, or missed patterns. Returns adjusted assessments. Use this as a second pass after initial classification.",
    input_schema: {
      type: "object",
      properties: {
        signals: {
          type: "array",
          items: { type: "object" },
          description: "Array of signal classification results to review",
        },
        context: {
          type: "string",
          description:
            "Additional context about the analysis goal or user focus",
        },
      },
      required: ["signals"],
    },
    roles: ["analysis"],
  },
];

/**
 * Registers analysis tools that wrap existing ICP matching and signal classification engines.
 */
export function registerAnalysisTools(
  registry: ToolRegistry,
  config: AppConfig
): void {
  let matcher: ICPMatcher | null = null;
  let classifier: SignalClassifier | null = null;

  // Lazy initialization
  function getMatcher(): ICPMatcher {
    if (!matcher) {
      matcher = new ICPMatcher(config.icpConfigPath);
    }
    return matcher;
  }

  function getClassifier(): SignalClassifier {
    if (!classifier) {
      classifier = new SignalClassifier(config.anthropicApiKey);
    }
    return classifier;
  }

  // match_icp_profile
  registry.register(analysisToolDefinitions[0], async (input) => {
    const event = input.event as RawEvent;
    const result = getMatcher().match(event);
    return result;
  });

  // classify_signal
  registry.register(analysisToolDefinitions[1], async (input) => {
    const event = input.event as RawEvent;
    const result = await getClassifier().classify(event);
    return result;
  });

  // classify_batch
  registry.register(analysisToolDefinitions[2], async (input) => {
    const events = input.events as RawEvent[];
    const concurrency = (input.concurrency as number) || 5;
    const resultMap = await getClassifier().classifyBatch(
      events,
      concurrency
    );
    // Convert Map to plain object for JSON serialization
    const results: Record<string, unknown> = {};
    for (const [id, classification] of resultMap) {
      results[id] = classification;
    }
    return { results, count: events.length };
  });

  // cross_reference_signals
  registry.register(analysisToolDefinitions[3], async (input) => {
    const signals = input.signals as Array<{
      company?: { companyName?: string };
      signal?: { category?: string };
      source?: { platform?: string };
      eventId?: string;
    }>;

    // Group by company
    const byCompany = new Map<string, typeof signals>();
    for (const sig of signals) {
      const company =
        sig.company?.companyName ?? "Unknown";
      const existing = byCompany.get(company) ?? [];
      existing.push(sig);
      byCompany.set(company, existing);
    }

    // Find companies with multiple signals
    const multiSignalCompanies: Array<{
      company: string;
      signalCount: number;
      sources: string[];
      categories: string[];
      eventIds: string[];
    }> = [];

    for (const [company, sigs] of byCompany) {
      if (sigs.length > 1) {
        multiSignalCompanies.push({
          company,
          signalCount: sigs.length,
          sources: [
            ...new Set(
              sigs.map((s) => s.source?.platform ?? "unknown")
            ),
          ],
          categories: [
            ...new Set(
              sigs.map(
                (s) => s.signal?.category ?? "unknown"
              )
            ),
          ],
          eventIds: sigs
            .map((s) => s.eventId)
            .filter(Boolean) as string[],
        });
      }
    }

    return {
      totalSignals: signals.length,
      uniqueCompanies: byCompany.size,
      multiSignalCompanies,
      crossSourceMatches: multiSignalCompanies.filter(
        (c) => c.sources.length > 1
      ),
    };
  });

  // reflect_on_quality
  registry.register(analysisToolDefinitions[4], async (input) => {
    const signals = input.signals as Array<{
      eventId?: string;
      signal?: {
        isSignal?: boolean;
        confidence?: number;
        category?: string;
        strength?: string;
        reasoning?: string;
      };
      rawContent?: { body?: string; title?: string };
    }>;
    const context = (input.context as string) || "";

    const reflections: Array<{
      eventId: string;
      originalConfidence: number;
      adjustedConfidence: number;
      flag?: string;
      note: string;
    }> = [];

    for (const sig of signals) {
      const conf = sig.signal?.confidence ?? 0;
      const body =
        (sig.rawContent?.body ?? "").toLowerCase();
      let adjustedConfidence = conf;
      let flag: string | undefined;
      let note = "No adjustment needed";

      // Check for generic content that may be false positive
      const genericTerms = [
        "just learned about",
        "interesting article",
        "check this out",
        "great read",
        "sharing this",
      ];
      const hasGenericContent = genericTerms.some((t) =>
        body.includes(t)
      );

      if (hasGenericContent && conf > 0.5) {
        adjustedConfidence = Math.max(conf - 0.2, 0.1);
        flag = "possible_false_positive";
        note =
          "Content appears to be sharing/commentary rather than a genuine buying signal. Confidence reduced.";
      }

      // Check for very short content with high confidence
      if (body.length < 50 && conf > 0.6) {
        adjustedConfidence = Math.min(adjustedConfidence, 0.5);
        flag = flag ?? "low_content";
        note =
          "Very short content — insufficient evidence for high confidence.";
      }

      // Check for strong signals that might be under-rated
      const strongIndicators = [
        "rfp",
        "rfq",
        "vendor selection",
        "evaluating",
        "shortlisted",
      ];
      const hasStrongIndicator = strongIndicators.some((t) =>
        body.includes(t)
      );
      if (hasStrongIndicator && conf < 0.7) {
        adjustedConfidence = Math.max(conf + 0.15, 0.7);
        flag = "possibly_underrated";
        note =
          "Content contains strong buying indicators — confidence increased.";
      }

      reflections.push({
        eventId: sig.eventId ?? "unknown",
        originalConfidence: conf,
        adjustedConfidence: Math.round(adjustedConfidence * 100) / 100,
        flag,
        note,
      });
    }

    return {
      reflections,
      context,
      adjustedCount: reflections.filter(
        (r) => r.originalConfidence !== r.adjustedConfidence
      ).length,
      totalReviewed: reflections.length,
    };
  });

  logger.info(
    `Registered ${analysisToolDefinitions.length} analysis tools`
  );
}
