import { CronJob } from "cron";
import type { AppConfig } from "../types.js";
import { Pipeline } from "./pipeline.js";
import { logger } from "../utils/logger.js";

/**
 * Cron-based scheduler that runs the pipeline at configured intervals.
 * Supports both legacy pipeline mode and agent mode.
 */
export class Scheduler {
  private config: AppConfig;
  private job: CronJob | null = null;
  private running = false;

  constructor(config: AppConfig) {
    this.config = config;
  }

  start(): void {
    const mode = this.config.agent.agentMode ? "agent" : "legacy";
    logger.info(
      `Scheduler starting in ${mode} mode with cron: "${this.config.cronSchedule}"`
    );

    this.job = new CronJob(
      this.config.cronSchedule,
      () => void this.tick(),
      null,
      true,
      "UTC"
    );

    logger.info("Scheduler started. Running initial pipeline...");
    void this.tick();
  }

  stop(): void {
    if (this.job) {
      this.job.stop();
      this.job = null;
      logger.info("Scheduler stopped");
    }
  }

  private async tick(): Promise<void> {
    if (this.running) {
      logger.warn("Previous pipeline run still in progress, skipping");
      return;
    }

    this.running = true;
    try {
      if (this.config.agent.agentMode) {
        await this.tickAgent();
      } else {
        await this.tickLegacy();
      }
    } catch (err) {
      logger.error(
        `Scheduled run failed: ${err instanceof Error ? err.message : err}`
      );
    } finally {
      this.running = false;
    }
  }

  private async tickLegacy(): Promise<void> {
    const pipeline = new Pipeline(this.config);
    const result = await pipeline.run();
    logger.info(
      `Scheduled run complete: ${result.totalSignals} signals (run ${result.runId})`
    );
  }

  private async tickAgent(): Promise<void> {
    const { OrchestratorAgent } = await import(
      "../agents/orchestrator.js"
    );
    const { createToolRegistry } = await import(
      "../tools/tool-registry.js"
    );
    const { registerCollectorTools } = await import(
      "../tools/collector-tools.js"
    );
    const { registerAnalysisTools } = await import(
      "../tools/analysis-tools.js"
    );
    const { registerOutputTools } = await import(
      "../tools/output-tools.js"
    );
    const { registerMemoryTools } = await import(
      "../tools/memory-tools.js"
    );

    const toolRegistry = createToolRegistry();
    registerCollectorTools(toolRegistry, this.config);
    registerAnalysisTools(toolRegistry, this.config);
    registerOutputTools(toolRegistry, this.config);
    registerMemoryTools(toolRegistry, this.config.agent.memoryDir);

    const orchestrator = new OrchestratorAgent(
      this.config,
      toolRegistry
    );

    const result = await orchestrator.ask(
      "Run a full scan across all enabled sources. Collect events, classify signals, " +
        "cross-reference with company history, and save results. Report a summary of findings."
    );

    logger.info(
      `Agent scheduled run complete: ${result.steps.length} steps, ${result.tokenUsage.totalTokens} tokens`
    );
  }
}
