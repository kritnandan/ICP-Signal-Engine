import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { MemoryStore } from "../../src/memory/memory-store.js";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";

const TEST_DIR = join(process.cwd(), "test-data", "memory-test");
const TEST_FILE = join(TEST_DIR, "test-store.json");

interface TestItem {
  id: string;
  name: string;
  score: number;
}

describe("MemoryStore", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    // Remove test file if exists
    if (existsSync(TEST_FILE)) {
      rmSync(TEST_FILE);
    }
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it("creates an empty store", () => {
    const store = new MemoryStore<TestItem>(TEST_FILE);
    expect(store.size).toBe(0);
    expect(store.getAll()).toEqual([]);
  });

  it("appends items and persists to disk", () => {
    const store = new MemoryStore<TestItem>(TEST_FILE);
    store.append({ id: "1", name: "Alpha", score: 0.9 });
    store.append({ id: "2", name: "Beta", score: 0.7 });

    expect(store.size).toBe(2);

    // Reload from disk
    const store2 = new MemoryStore<TestItem>(TEST_FILE);
    expect(store2.size).toBe(2);
    expect(store2.getAll()[0].name).toBe("Alpha");
  });

  it("finds items by predicate", () => {
    const store = new MemoryStore<TestItem>(TEST_FILE);
    store.append({ id: "1", name: "Alpha", score: 0.9 });
    store.append({ id: "2", name: "Beta", score: 0.7 });

    const found = store.find((item) => item.name === "Beta");
    expect(found).toBeDefined();
    expect(found!.id).toBe("2");
  });

  it("filters items by predicate", () => {
    const store = new MemoryStore<TestItem>(TEST_FILE);
    store.append({ id: "1", name: "Alpha", score: 0.9 });
    store.append({ id: "2", name: "Beta", score: 0.7 });
    store.append({ id: "3", name: "Gamma", score: 0.4 });

    const highScore = store.filter((item) => item.score > 0.6);
    expect(highScore).toHaveLength(2);
  });

  it("upserts — updates existing or inserts new", () => {
    const store = new MemoryStore<TestItem>(TEST_FILE);
    store.append({ id: "1", name: "Alpha", score: 0.5 });

    // Update existing
    const updated = store.upsert(
      (item) => item.id === "1",
      (existing) => ({ ...existing, score: 0.9 }),
      { id: "1", name: "Alpha", score: 0.9 }
    );
    expect(updated.score).toBe(0.9);
    expect(store.size).toBe(1);

    // Insert new
    const inserted = store.upsert(
      (item) => item.id === "2",
      (existing) => existing,
      { id: "2", name: "Beta", score: 0.7 }
    );
    expect(inserted.name).toBe("Beta");
    expect(store.size).toBe(2);
  });

  it("removes items by predicate", () => {
    const store = new MemoryStore<TestItem>(TEST_FILE);
    store.append({ id: "1", name: "Alpha", score: 0.9 });
    store.append({ id: "2", name: "Beta", score: 0.7 });

    const removed = store.remove((item) => item.id === "1");
    expect(removed).toBe(1);
    expect(store.size).toBe(1);
    expect(store.getAll()[0].name).toBe("Beta");
  });

  it("queries with sort, limit, and offset", () => {
    const store = new MemoryStore<TestItem>(TEST_FILE);
    store.append({ id: "1", name: "Alpha", score: 0.3 });
    store.append({ id: "2", name: "Beta", score: 0.9 });
    store.append({ id: "3", name: "Gamma", score: 0.6 });
    store.append({ id: "4", name: "Delta", score: 0.1 });

    const results = store.query({
      sort: (a, b) => b.score - a.score,
      limit: 2,
    });

    expect(results).toHaveLength(2);
    expect(results[0].name).toBe("Beta");
    expect(results[1].name).toBe("Gamma");

    // With offset
    const page2 = store.query({
      sort: (a, b) => b.score - a.score,
      offset: 2,
      limit: 2,
    });
    expect(page2).toHaveLength(2);
    expect(page2[0].name).toBe("Alpha");
  });

  it("clears all data", () => {
    const store = new MemoryStore<TestItem>(TEST_FILE);
    store.append({ id: "1", name: "Alpha", score: 0.9 });
    store.append({ id: "2", name: "Beta", score: 0.7 });

    store.clear();
    expect(store.size).toBe(0);

    // Verify persistence
    const store2 = new MemoryStore<TestItem>(TEST_FILE);
    expect(store2.size).toBe(0);
  });
});
