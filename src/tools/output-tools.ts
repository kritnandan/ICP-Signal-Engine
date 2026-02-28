import type {
  AgentToolDefinition,
  BuyingSignalEvent,
} from "../types.js";
import type { AppConfig } from "../types.js";
import type { ToolRegistry } from "./tool-registry.js";
import { OutputWriter } from "../output/writer.js";
import { generateEventId } from "../utils/id.js";
import { logger } from "../utils/logger.js";

const outputToolDefinitions: AgentToolDefinition[] = [
  {
    name: "write_signal_output",
    description:
      "Write classified buying signal events to output files (individual JSON + batch JSONL + latest.json summary). Validates events with Zod before writing.",
    input_schema: {
      type: "object",
      properties: {
        events: {
          type: "array",
          items: { type: "object" },
          description: "Array of BuyingSignalEvent objects to write",
        },
      },
      required: ["events"],
    },
    roles: ["orchestrator"],
  },
  {
    name: "generate_nl_summary",
    description:
      "Generate a natural language summary of signal results for display to the user. Formats signals into readable text with key findings, company highlights, and recommended actions.",
    input_schema: {
      type: "object",
      properties: {
        events: {
          type: "array",
          items: { type: "object" },
          description: "Array of BuyingSignalEvent objects to summarize",
        },
        style: {
          type: "string",
          enum: ["detailed", "summary", "minimal"],
          description:
            "Output style: detailed (full analysis), summary (key points), minimal (counts only)",
        },
      },
      required: ["events"],
    },
    roles: ["orchestrator", "analysis"],
  },
  {
    name: "format_for_display",
    description:
      "Format a single signal event for console display with color-coded sections.",
    input_schema: {
      type: "object",
      properties: {
        event: {
          type: "object",
          description: "A BuyingSignalEvent to format for display",
        },
      },
      required: ["event"],
    },
    roles: ["orchestrator"],
  },
];

/**
 * Registers output tools for writing and formatting signal results.
 */
export function registerOutputTools(
  registry: ToolRegistry,
  config: AppConfig
): void {
  let writer: OutputWriter | null = null;

  function getWriter(): OutputWriter {
    if (!writer) {
      writer = new OutputWriter(config.outputDir);
    }
    return writer;
  }

  // write_signal_output
  registry.register(outputToolDefinitions[0], async (input) => {
    const events = input.events as BuyingSignalEvent[];
    const w = getWriter();
    const runId = generateEventId("run");

    let written = 0;
    for (const event of events) {
      try {
        w.writeEvent(event);
        written++;
      } catch (err) {
        logger.warn(
          `Failed to write event ${event.eventId}: ${err instanceof Error ? err.message : err}`
        );
      }
    }

    const batchFile = w.writeBatch(events, runId);

    return {
      runId,
      written,
      total: events.length,
      batchFile,
      outputDir: config.outputDir,
    };
  });

  // generate_nl_summary
  registry.register(outputToolDefinitions[1], async (input) => {
    const events = input.events as BuyingSignalEvent[];
    const style = (input.style as string) || "summary";

    if (events.length === 0) {
      return { summary: "No signals found in this run." };
    }

    // Build summary based on style
    const signalCount = events.filter(
      (e) => e.signal.isSignal
    ).length;
    const strongSignals = events.filter(
      (e) => e.signal.strength === "strong"
    );
    const companies = [
      ...new Set(events.map((e) => e.company.companyName)),
    ];
    const categories = events.reduce(
      (acc, e) => {
        acc[e.signal.category] = (acc[e.signal.category] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    if (style === "minimal") {
      return {
        summary: `Found ${signalCount} signals from ${companies.length} companies across ${Object.keys(categories).length} categories.`,
      };
    }

    const lines: string[] = [];
    lines.push(`## Signal Analysis Summary`);
    lines.push(``);
    lines.push(
      `Found **${signalCount} buying signals** from **${companies.length} companies**.`
    );

    if (strongSignals.length > 0) {
      lines.push(``);
      lines.push(`### Strong Signals (${strongSignals.length})`);
      for (const sig of strongSignals.slice(0, 10)) {
        lines.push(
          `- **${sig.company?.companyName || "Unknown"}** [${sig.signal?.category || "Uncategorized"}] — ${sig.signal?.reasoning || "No reasoning provided"}`
        );
      }
    }

    lines.push(``);
    lines.push(`### By Category`);
    for (const [cat, count] of Object.entries(categories).sort(
      (a, b) => b[1] - a[1]
    )) {
      lines.push(`- ${cat}: ${count}`);
    }

    if (style === "detailed") {
      lines.push(``);
      lines.push(`### All Signals`);
      for (const event of events) {
        lines.push(``);
        lines.push(
          `**${event.company?.companyName || "Unknown"}** (${event.source?.platform || "Unknown"})`
        );
        lines.push(
          `  Category: ${event.signal.category} | Strength: ${event.signal.strength} | Confidence: ${event.signal.confidence}`
        );
        lines.push(`  Stage: ${event.signal.buyingStage}`);
        lines.push(`  ${event.signal.reasoning}`);
        if (event.signal.suggestedActions.length > 0) {
          lines.push(
            `  Actions: ${event.signal.suggestedActions.join("; ")}`
          );
        }
      }
    }

    return { summary: lines.join("\n") };
  });

  // format_for_display
  registry.register(outputToolDefinitions[2], async (input) => {
    const event = input.event as BuyingSignalEvent;

    const strengthIcon =
      event.signal.strength === "strong"
        ? "[!!!]"
        : event.signal.strength === "moderate"
          ? "[!!]"
          : "[!]";

    const lines = [
      `${strengthIcon} ${event.company?.companyName || "Unknown"} — ${event.signal?.category || "Uncategorized"}`,
      `  Source: ${event.source?.platform || "Unknown"} | Confidence: ${((event.signal?.confidence || 0) * 100).toFixed(0)}%`,
      `  Stage: ${event.signal?.buyingStage || "Unknown"} | Score: ${((event.company?.matchScore || 0) * 100).toFixed(0)}%`,
      `  ${event.signal?.reasoning || "No reasoning provided"}`,
    ];

    if (event.rawContent?.title) {
      lines.push(`  Title: ${event.rawContent.title}`);
    }

    return { formatted: lines.join("\n") };
  });

  logger.info(
    `Registered ${outputToolDefinitions.length} output tools`
  );
}
