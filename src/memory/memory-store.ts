import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { logger } from "../utils/logger.js";

/**
 * Generic file-based JSON store with CRUD operations.
 * Each store maps to a single JSON file containing an array of items.
 */
export class MemoryStore<T extends object> {
  private filePath: string;
  private data: T[];

  constructor(filePath: string) {
    this.filePath = filePath;
    this.data = this.load();
  }

  private load(): T[] {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, "utf-8");
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (err) {
      logger.warn(
        `Failed to load memory from ${this.filePath}: ${err instanceof Error ? err.message : err}`
      );
    }
    return [];
  }

  private save(): void {
    try {
      const dir = dirname(this.filePath);
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        this.filePath,
        JSON.stringify(this.data, null, 2),
        "utf-8"
      );
    } catch (err) {
      logger.error(
        `Failed to save memory to ${this.filePath}: ${err instanceof Error ? err.message : err}`
      );
    }
  }

  getAll(): T[] {
    return [...this.data];
  }

  find(predicate: (item: T) => boolean): T | undefined {
    return this.data.find(predicate);
  }

  filter(predicate: (item: T) => boolean): T[] {
    return this.data.filter(predicate);
  }

  append(item: T): void {
    this.data.push(item);
    this.save();
  }

  upsert(
    matchFn: (item: T) => boolean,
    updateFn: (existing: T) => T,
    newItem: T
  ): T {
    const index = this.data.findIndex(matchFn);
    if (index >= 0) {
      this.data[index] = updateFn(this.data[index]);
      this.save();
      return this.data[index];
    }
    this.data.push(newItem);
    this.save();
    return newItem;
  }

  remove(predicate: (item: T) => boolean): number {
    const before = this.data.length;
    this.data = this.data.filter((item) => !predicate(item));
    const removed = before - this.data.length;
    if (removed > 0) this.save();
    return removed;
  }

  query(
    options: {
      filter?: (item: T) => boolean;
      sort?: (a: T, b: T) => number;
      limit?: number;
      offset?: number;
    } = {}
  ): T[] {
    let results = options.filter
      ? this.data.filter(options.filter)
      : [...this.data];

    if (options.sort) {
      results.sort(options.sort);
    }

    if (options.offset) {
      results = results.slice(options.offset);
    }

    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  get size(): number {
    return this.data.length;
  }

  clear(): void {
    this.data = [];
    this.save();
  }

  reload(): void {
    this.data = this.load();
  }
}
