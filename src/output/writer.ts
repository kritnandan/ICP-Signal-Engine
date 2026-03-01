import { mkdirSync, writeFileSync, appendFileSync } from "fs";
import { join } from "path";
import type { BuyingSignalEvent } from "../types.js";
import { BuyingSignalEventSchema } from "../types.js";
import { logger } from "../utils/logger.js";

/**
 * Structured JSON output writer.
 *
 * Writes validated BuyingSignalEvent objects to:
 * 1. Individual JSON files (one per event) in output/events/
 * 2. A batch JSONL file for the entire run in output/runs/
 * 3. A rolling "latest signals" summary in output/latest.json
 */
export class OutputWriter {
  private outputDir: string;
  private eventsDir: string;
  private runsDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
    this.eventsDir = join(outputDir, "events");
    this.runsDir = join(outputDir, "runs");

    mkdirSync(this.eventsDir, { recursive: true });
    mkdirSync(this.runsDir, { recursive: true });
  }

  writeEvent(event: BuyingSignalEvent): void {
    // Validate before writing
    const result = BuyingSignalEventSchema.safeParse(event);
    if (!result.success) {
      logger.warn(
        `Event ${event.eventId} failed validation: ${result.error.message}`
      );
      return;
    }

    // Write individual event file
    const filename = `${event.eventId}.json`;
    const filepath = join(this.eventsDir, filename);
    writeFileSync(filepath, JSON.stringify(event, null, 2), "utf-8");
  }

  writeBatch(events: BuyingSignalEvent[], runId: string): string {
    const runFile = join(this.runsDir, `${runId}.jsonl`);

    for (const event of events) {
      const result = BuyingSignalEventSchema.safeParse(event);
      if (result.success) {
        appendFileSync(runFile, JSON.stringify(event) + "\n", "utf-8");
      }
    }

    // Update latest.json
    this.writeLatest(events);

    logger.info(
      `Wrote ${events.length} events to ${runFile}`
    );

    return runFile;
  }

  private writeLatest(events: BuyingSignalEvent[]): void {
    const latestPath = join(this.outputDir, "latest.json");
    const summary = {
      updatedAt: new Date().toISOString(),
      totalEvents: events.length,
      signalCount: events.filter((e) => e.signal.isSignal).length,
      byCategory: this.groupBy(events, (e) => e.signal.category),
      byStrength: this.groupBy(events, (e) => e.signal.strength),
      bySource: this.groupBy(events, (e) => e.source.platform),
      events: events.slice(0, 50), // last 50 for quick access
    };
    writeFileSync(latestPath, JSON.stringify(summary, null, 2), "utf-8");
  }

  private groupBy(
    events: BuyingSignalEvent[],
    keyFn: (e: BuyingSignalEvent) => string
  ): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const e of events) {
      const key = keyFn(e);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }
}
