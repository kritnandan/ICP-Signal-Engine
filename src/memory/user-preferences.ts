import { join } from "path";
import type { UserPreferences } from "../types.js";
import { MemoryStore } from "./memory-store.js";

/**
 * Persistent user preferences learned from interactions.
 * Single-item store (one user per instance).
 */
export class UserPreferencesStore {
  private store: MemoryStore<UserPreferences>;

  constructor(memoryDir: string) {
    this.store = new MemoryStore<UserPreferences>(
      join(memoryDir, "preferences.json")
    );
  }

  get(): UserPreferences {
    const all = this.store.getAll();
    if (all.length > 0) {
      return all[0];
    }
    return { updatedAt: new Date().toISOString() };
  }

  update(partial: Partial<UserPreferences>): UserPreferences {
    const current = this.get();
    const updated: UserPreferences = {
      ...current,
      ...partial,
      updatedAt: new Date().toISOString(),
    };

    this.store.upsert(
      () => true,
      () => updated,
      updated
    );

    return updated;
  }

  setFocusCompanies(companies: string[]): void {
    this.update({ focusCompanies: companies });
  }

  setFocusIndustries(industries: string[]): void {
    this.update({ focusIndustries: industries });
  }

  setMinConfidence(confidence: number): void {
    this.update({
      minConfidence: Math.max(0, Math.min(1, confidence)),
    });
  }

  reset(): void {
    this.store.clear();
  }
}
