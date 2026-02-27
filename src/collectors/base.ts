import type { Collector, RawEvent, SourcePlatform } from "../types.js";
import { logger } from "../utils/logger.js";

export abstract class BaseCollector implements Collector {
  abstract name: SourcePlatform;

  abstract collect(): Promise<RawEvent[]>;

  protected log(message: string, meta?: Record<string, unknown>): void {
    logger.info(`[${this.name}] ${message}`, meta);
  }

  protected logError(message: string, error: unknown): void {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error(`[${this.name}] ${message}: ${errMsg}`);
  }

  protected truncate(text: string, maxLen = 5000): string {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + "…";
  }

  protected nowISO(): string {
    return new Date().toISOString();
  }
}
