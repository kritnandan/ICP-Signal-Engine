import type { AgentRole, TokenUsage } from "../types.js";
import { logger } from "./logger.js";

interface RunUsage {
  role: AgentRole;
  usage: TokenUsage;
  timestamp: string;
}

/**
 * Tracks API token usage per agent run for cost monitoring.
 */
export class CostTracker {
  private runs: RunUsage[] = [];

  addUsage(role: AgentRole, usage: TokenUsage): void {
    this.runs.push({
      role,
      usage,
      timestamp: new Date().toISOString(),
    });
  }

  getTotalUsage(): TokenUsage {
    return this.runs.reduce(
      (acc, r) => ({
        inputTokens: acc.inputTokens + r.usage.inputTokens,
        outputTokens: acc.outputTokens + r.usage.outputTokens,
        totalTokens: acc.totalTokens + r.usage.totalTokens,
      }),
      { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
    );
  }

  getUsageByRole(): Record<AgentRole, TokenUsage> {
    const byRole: Partial<Record<AgentRole, TokenUsage>> = {};
    for (const run of this.runs) {
      const existing = byRole[run.role] ?? {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      };
      byRole[run.role] = {
        inputTokens: existing.inputTokens + run.usage.inputTokens,
        outputTokens: existing.outputTokens + run.usage.outputTokens,
        totalTokens: existing.totalTokens + run.usage.totalTokens,
      };
    }
    return byRole as Record<AgentRole, TokenUsage>;
  }

  getRunCount(): number {
    return this.runs.length;
  }

  printSummary(): void {
    const total = this.getTotalUsage();
    logger.info(
      `Token usage — Input: ${total.inputTokens}, Output: ${total.outputTokens}, Total: ${total.totalTokens}`
    );
    const byRole = this.getUsageByRole();
    for (const [role, usage] of Object.entries(byRole)) {
      logger.info(`  ${role}: ${usage.totalTokens} tokens`);
    }
  }

  reset(): void {
    this.runs = [];
  }
}
