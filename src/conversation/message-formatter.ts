import type {
  BuyingSignalEvent,
  CompanyKnowledge,
  AgentRunResult,
} from "../types.js";

/**
 * Formats agent output for console display.
 * Uses ANSI escape codes for color-coded sections.
 */

const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
};

function c(color: keyof typeof COLORS, text: string): string {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

export function formatSignalEvent(event: BuyingSignalEvent): string {
  const strengthColors: Record<string, keyof typeof COLORS> = {
    strong: "red",
    moderate: "yellow",
    weak: "dim",
  };
  const strengthColor =
    strengthColors[event.signal.strength] ?? "white";

  const lines: string[] = [];
  lines.push(
    c("bold", `  ${event.company.companyName}`) +
      ` ${c(strengthColor, `[${event.signal.strength.toUpperCase()}]`)}`
  );
  lines.push(
    `  ${c("cyan", event.signal.category)} | ` +
      `Confidence: ${c("green", `${(event.signal.confidence * 100).toFixed(0)}%`)} | ` +
      `Stage: ${c("magenta", event.signal.buyingStage)} | ` +
      `Source: ${c("blue", event.source.platform)}`
  );
  lines.push(`  ${c("dim", event.signal.reasoning)}`);

  if (event.rawContent.title) {
    lines.push(`  ${c("dim", `"${event.rawContent.title}"`)}`);
  }

  return lines.join("\n");
}

export function formatSignalTable(
  events: BuyingSignalEvent[]
): string {
  if (events.length === 0) {
    return c("dim", "  No signals found.");
  }

  const lines: string[] = [];
  lines.push(
    c("bold", `\n  Found ${events.length} buying signal(s):\n`)
  );

  // Group by strength
  const strong = events.filter(
    (e) => e.signal.strength === "strong"
  );
  const moderate = events.filter(
    (e) => e.signal.strength === "moderate"
  );
  const weak = events.filter((e) => e.signal.strength === "weak");

  if (strong.length > 0) {
    lines.push(c("red", `  --- STRONG (${strong.length}) ---`));
    for (const event of strong) {
      lines.push(formatSignalEvent(event));
      lines.push("");
    }
  }

  if (moderate.length > 0) {
    lines.push(
      c("yellow", `  --- MODERATE (${moderate.length}) ---`)
    );
    for (const event of moderate) {
      lines.push(formatSignalEvent(event));
      lines.push("");
    }
  }

  if (weak.length > 0) {
    lines.push(c("dim", `  --- WEAK (${weak.length}) ---`));
    for (const event of weak.slice(0, 5)) {
      lines.push(formatSignalEvent(event));
      lines.push("");
    }
    if (weak.length > 5) {
      lines.push(
        c("dim", `  ... and ${weak.length - 5} more weak signals`)
      );
    }
  }

  return lines.join("\n");
}

export function formatCompanyProfile(
  company: CompanyKnowledge
): string {
  const lines: string[] = [];
  lines.push(c("bold", `\n  Company: ${company.companyName}`));
  if (company.aliases.length > 0) {
    lines.push(
      c("dim", `  Also known as: ${company.aliases.join(", ")}`)
    );
  }

  lines.push(
    `  Total Signals: ${c("green", String(company.signalCount))}`
  );
  lines.push(
    `  Buying Stage: ${c("magenta", company.latestBuyingStage ?? "unknown")}`
  );
  lines.push(
    `  First Seen: ${c("dim", company.firstSeenAt)}`
  );
  lines.push(
    `  Last Seen: ${c("dim", company.lastSeenAt)}`
  );

  if (Object.keys(company.categories).length > 0) {
    lines.push(c("cyan", "  Categories:"));
    for (const [cat, count] of Object.entries(
      company.categories
    ).sort((a, b) => b[1] - a[1])) {
      lines.push(`    ${cat}: ${count}`);
    }
  }

  if (company.notes.length > 0) {
    lines.push(c("yellow", "  Notes:"));
    for (const note of company.notes.slice(-5)) {
      lines.push(`    ${note}`);
    }
  }

  return lines.join("\n");
}

export function formatAgentResult(result: AgentRunResult): string {
  const lines: string[] = [];

  lines.push(result.finalResponse);
  lines.push("");
  lines.push(
    c(
      "dim",
      `  [${result.agentRole} | ${result.steps.length} steps | ` +
        `${result.tokenUsage.totalTokens} tokens | ${(result.durationMs / 1000).toFixed(1)}s]`
    )
  );

  return lines.join("\n");
}

export function formatWelcome(): string {
  const lines = [
    "",
    c("bold", "  ICP Buying Signal Monitor — Agentic Mode"),
    c("dim", "  Powered by Claude AI"),
    "",
    "  Ask me anything about buying signals in procurement,",
    "  supply chain, and logistics. Examples:",
    "",
    c("cyan", '  > "Find TMS signals from manufacturing companies"'),
    c("cyan", '  > "What do we know about Acme Corp?"'),
    c("cyan", '  > "Show me strong signals from the last week"'),
    c("cyan", '  > "Analyze buying signals on Reddit"'),
    "",
    c("dim", "  Commands: /help /status /companies /history /export /quit"),
    "",
  ];
  return lines.join("\n");
}

export function formatHelp(): string {
  const lines = [
    "",
    c("bold", "  Available Commands:"),
    "",
    `  ${c("cyan", "/help")}        Show this help message`,
    `  ${c("cyan", "/status")}      Show system status and token usage`,
    `  ${c("cyan", "/companies")}   List tracked companies`,
    `  ${c("cyan", "/history")}     Show recent signal history`,
    `  ${c("cyan", "/feedback")}    Record feedback: /feedback <eventId> <relevant|irrelevant>`,
    `  ${c("cyan", "/analyze")}     Run full analysis and save markdown report`,
    `  ${c("cyan", "/analyze <t>")} Run focused analysis on topic <t>`,
    `  ${c("cyan", "/export")}      Export current results to JSON`,
    `  ${c("cyan", "/clear")}       Clear conversation context`,
    `  ${c("cyan", "/quit")}        Exit the REPL`,
    "",
    c("dim", "  Or just type a question in natural language!"),
    "",
  ];
  return lines.join("\n");
}

export function formatStatus(
  tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number },
  runCount: number,
  companyCount: number,
  signalCount: number
): string {
  const lines = [
    "",
    c("bold", "  System Status:"),
    `  API Calls: ${runCount}`,
    `  Tokens Used: ${tokenUsage.totalTokens} (in: ${tokenUsage.inputTokens}, out: ${tokenUsage.outputTokens})`,
    `  Companies Tracked: ${companyCount}`,
    `  Signals in History: ${signalCount}`,
    "",
  ];
  return lines.join("\n");
}

/**
 * Formats an AgentRunResult as a clean markdown report (no ANSI codes).
 * Suitable for saving to .md files and sharing.
 */
export function formatAnalysisReportMarkdown(
  result: AgentRunResult,
  query: string
): string {
  const lines: string[] = [];

  lines.push("# ICP Buying Signal Analysis Report");
  lines.push("");
  lines.push(`**Generated:** ${new Date().toISOString()}  `);
  lines.push(`**Query:** ${query}  `);
  lines.push(
    `**Duration:** ${(result.durationMs / 1000).toFixed(1)}s | ` +
      `**Tokens:** ${result.tokenUsage.totalTokens} | ` +
      `**Agent Steps:** ${result.steps.length}`
  );
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Findings");
  lines.push("");
  lines.push(result.finalResponse);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Agent trace table
  const toolSteps = result.steps.filter((s) => s.toolName);
  if (toolSteps.length > 0) {
    lines.push("## Agent Trace");
    lines.push("");
    lines.push("| Step | Tool Used | Input Summary |");
    lines.push("|------|-----------|---------------|");
    for (let i = 0; i < toolSteps.length; i++) {
      const step = toolSteps[i];
      const inputSummary = step.toolInput
        ? Object.entries(step.toolInput)
            .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
            .join(", ")
            .slice(0, 80)
        : "-";
      lines.push(`| ${i + 1} | ${step.toolName} | ${inputSummary} |`);
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  lines.push("*Generated by ICP Buying Signal Monitor — Agentic Mode*");
  lines.push("");

  return lines.join("\n");
}
