import { join } from "path";
import type {
  BuyingSignalEvent,
  SignalCategory,
} from "../types.js";
import { MemoryStore } from "./memory-store.js";

interface StoredSignal {
  eventId: string;
  companyName: string;
  category: SignalCategory;
  strength: string;
  confidence: number;
  buyingStage: string;
  source: string;
  url: string;
  title?: string;
  bodyHash: string;
  timestamp: string;
}

/**
 * Past signal storage with deduplication and trend detection.
 */
export class SignalHistory {
  private store: MemoryStore<StoredSignal>;

  constructor(memoryDir: string) {
    this.store = new MemoryStore<StoredSignal>(
      join(memoryDir, "signals.json")
    );
  }

  /**
   * Record a signal. Returns false if it's a duplicate.
   */
  record(event: BuyingSignalEvent): boolean {
    const bodyHash = this.hashBody(event.rawContent.body);

    // Check for duplicate
    const isDuplicate = this.store.find(
      (item) => item.bodyHash === bodyHash || item.url === event.source.url
    );

    if (isDuplicate) {
      return false;
    }

    this.store.append({
      eventId: event.eventId,
      companyName: event.company.companyName,
      category: event.signal.category,
      strength: event.signal.strength,
      confidence: event.signal.confidence,
      buyingStage: event.signal.buyingStage,
      source: event.source.platform,
      url: event.source.url,
      title: event.rawContent.title,
      bodyHash,
      timestamp: event.timestamp,
    });

    return true;
  }

  isDuplicate(url: string, body: string): boolean {
    const bodyHash = this.hashBody(body);
    return !!this.store.find(
      (item) => item.bodyHash === bodyHash || item.url === url
    );
  }

  getByCompany(companyName: string): StoredSignal[] {
    return this.store.filter(
      (item) =>
        item.companyName.toLowerCase() ===
        companyName.toLowerCase()
    );
  }

  getByCategory(category: SignalCategory): StoredSignal[] {
    return this.store.filter(
      (item) => item.category === category
    );
  }

  getRecent(limit = 50): StoredSignal[] {
    return this.store.query({
      sort: (a, b) =>
        new Date(b.timestamp).getTime() -
        new Date(a.timestamp).getTime(),
      limit,
    });
  }

  getSince(date: string): StoredSignal[] {
    const since = new Date(date).getTime();
    return this.store.filter(
      (item) => new Date(item.timestamp).getTime() >= since
    );
  }

  /**
   * Detect trending categories: categories with increasing signal counts
   * in recent time windows.
   */
  detectTrends(
    windowDays = 7
  ): Array<{ category: SignalCategory; count: number; trend: "up" | "stable" | "down" }> {
    const now = Date.now();
    const windowMs = windowDays * 24 * 60 * 60 * 1000;

    const recent = this.store.filter(
      (item) => now - new Date(item.timestamp).getTime() < windowMs
    );
    const older = this.store.filter(
      (item) => {
        const age = now - new Date(item.timestamp).getTime();
        return age >= windowMs && age < windowMs * 2;
      }
    );

    const recentCounts = new Map<string, number>();
    const olderCounts = new Map<string, number>();

    for (const sig of recent) {
      recentCounts.set(
        sig.category,
        (recentCounts.get(sig.category) ?? 0) + 1
      );
    }
    for (const sig of older) {
      olderCounts.set(
        sig.category,
        (olderCounts.get(sig.category) ?? 0) + 1
      );
    }

    const allCategories = new Set([
      ...recentCounts.keys(),
      ...olderCounts.keys(),
    ]);

    return Array.from(allCategories).map((cat) => {
      const recentCount = recentCounts.get(cat) ?? 0;
      const olderCount = olderCounts.get(cat) ?? 0;
      const trend =
        recentCount > olderCount
          ? "up"
          : recentCount < olderCount
            ? "down"
            : "stable";
      return {
        category: cat as SignalCategory,
        count: recentCount,
        trend,
      };
    });
  }

  get size(): number {
    return this.store.size;
  }

  private hashBody(body: string): string {
    // Simple hash: normalized first 200 chars
    const normalized = body
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `h${Math.abs(hash).toString(36)}`;
  }
}
