import { join } from "path";
import type {
  CompanyKnowledge,
  BuyingSignalEvent,
  BuyingStage,
} from "../types.js";
import { MemoryStore } from "./memory-store.js";
import { logger } from "../utils/logger.js";

const BUYING_STAGE_ORDER: BuyingStage[] = [
  "awareness",
  "research",
  "evaluation",
  "decision",
  "implementation",
];

/**
 * Company-level knowledge accumulation.
 * Tracks signals per company, category distribution, buying stage progression.
 */
export class CompanyMemory {
  private store: MemoryStore<CompanyKnowledge>;

  constructor(memoryDir: string) {
    this.store = new MemoryStore<CompanyKnowledge>(
      join(memoryDir, "companies.json")
    );
  }

  /**
   * Record a signal event for a company, creating or updating knowledge.
   */
  recordSignal(event: BuyingSignalEvent): CompanyKnowledge {
    const companyName = event.company.companyName;
    const now = new Date().toISOString();
    const category = event.signal.category;

    return this.store.upsert(
      (item) =>
        item.companyName.toLowerCase() === companyName.toLowerCase(),
      (existing) => {
        // Update category counts
        existing.categories[category] =
          (existing.categories[category] ?? 0) + 1;

        // Update buying stage if it progresses
        if (event.signal.buyingStage) {
          const currentIdx = BUYING_STAGE_ORDER.indexOf(
            existing.latestBuyingStage ?? "awareness"
          );
          const newIdx = BUYING_STAGE_ORDER.indexOf(
            event.signal.buyingStage
          );
          if (newIdx > currentIdx) {
            existing.latestBuyingStage = event.signal.buyingStage;
          }
        }

        existing.signalCount++;
        existing.lastSeenAt = now;
        if (!existing.signalIds.includes(event.eventId)) {
          existing.signalIds.push(event.eventId);
        }

        return existing;
      },
      {
        companyName,
        aliases: [],
        signalCount: 1,
        categories: { [category]: 1 },
        latestBuyingStage: event.signal.buyingStage,
        firstSeenAt: now,
        lastSeenAt: now,
        notes: [],
        signalIds: [event.eventId],
      }
    );
  }

  getCompany(name: string): CompanyKnowledge | undefined {
    return this.store.find(
      (item) =>
        item.companyName.toLowerCase() === name.toLowerCase() ||
        item.aliases.some(
          (a) => a.toLowerCase() === name.toLowerCase()
        )
    );
  }

  getAllCompanies(): CompanyKnowledge[] {
    return this.store.getAll();
  }

  getTopCompanies(limit = 10): CompanyKnowledge[] {
    return this.store.query({
      sort: (a, b) => b.signalCount - a.signalCount,
      limit,
    });
  }

  getCompaniesByStage(stage: BuyingStage): CompanyKnowledge[] {
    return this.store.filter(
      (item) => item.latestBuyingStage === stage
    );
  }

  addNote(companyName: string, note: string): void {
    const company = this.getCompany(companyName);
    if (company) {
      this.store.upsert(
        (item) =>
          item.companyName.toLowerCase() ===
          companyName.toLowerCase(),
        (existing) => {
          existing.notes.push(
            `[${new Date().toISOString()}] ${note}`
          );
          return existing;
        },
        company
      );
      logger.debug(`Added note to ${companyName}`);
    }
  }

  addAlias(companyName: string, alias: string): void {
    this.store.upsert(
      (item) =>
        item.companyName.toLowerCase() ===
        companyName.toLowerCase(),
      (existing) => {
        if (
          !existing.aliases
            .map((a) => a.toLowerCase())
            .includes(alias.toLowerCase())
        ) {
          existing.aliases.push(alias);
        }
        return existing;
      },
      {
        companyName,
        aliases: [alias],
        signalCount: 0,
        categories: {},
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        notes: [],
        signalIds: [],
      }
    );
  }

  get size(): number {
    return this.store.size;
  }
}
