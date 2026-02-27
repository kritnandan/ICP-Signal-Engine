import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { CompanyMemory } from "../../src/memory/company-memory.js";
import type { BuyingSignalEvent } from "../../src/types.js";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";

const TEST_DIR = join(process.cwd(), "test-data", "company-memory-test");

function makeEvent(
  overrides: Partial<BuyingSignalEvent> = {}
): BuyingSignalEvent {
  return {
    eventId: "evt_test_001",
    timestamp: new Date().toISOString(),
    source: {
      platform: "reddit",
      contentType: "post",
      url: "https://reddit.com/r/test",
    },
    company: {
      companyName: "TestCorp",
      matchScore: 0.75,
      matchedCriteria: ["content_relevance_high"],
      unmatchedCriteria: [],
    },
    signal: {
      isSignal: true,
      confidence: 0.8,
      category: "tms_logistics",
      strength: "strong",
      buyingStage: "research",
      reasoning: "Active TMS research",
      keywords: ["TMS"],
      suggestedActions: ["Reach out"],
    },
    rawContent: {
      body: "Looking for TMS solutions",
    },
    pipeline: {
      collectedAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      pipelineVersion: "1.0.0",
    },
    ...overrides,
  };
}

describe("CompanyMemory", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it("records a signal and creates company knowledge", () => {
    const memory = new CompanyMemory(TEST_DIR);
    const event = makeEvent();

    const knowledge = memory.recordSignal(event);

    expect(knowledge.companyName).toBe("TestCorp");
    expect(knowledge.signalCount).toBe(1);
    expect(knowledge.categories["tms_logistics"]).toBe(1);
    expect(knowledge.latestBuyingStage).toBe("research");
    expect(knowledge.signalIds).toContain("evt_test_001");
  });

  it("accumulates signals for the same company", () => {
    const memory = new CompanyMemory(TEST_DIR);

    memory.recordSignal(makeEvent({ eventId: "evt_001" }));
    memory.recordSignal(
      makeEvent({
        eventId: "evt_002",
        signal: {
          ...makeEvent().signal,
          category: "procurement_sourcing",
          buyingStage: "evaluation",
        },
      })
    );

    const company = memory.getCompany("TestCorp");
    expect(company).toBeDefined();
    expect(company!.signalCount).toBe(2);
    expect(company!.categories["tms_logistics"]).toBe(1);
    expect(company!.categories["procurement_sourcing"]).toBe(1);
    expect(company!.latestBuyingStage).toBe("evaluation");
  });

  it("does not regress buying stage", () => {
    const memory = new CompanyMemory(TEST_DIR);

    memory.recordSignal(
      makeEvent({
        signal: { ...makeEvent().signal, buyingStage: "evaluation" },
      })
    );
    memory.recordSignal(
      makeEvent({
        eventId: "evt_002",
        signal: { ...makeEvent().signal, buyingStage: "awareness" },
      })
    );

    const company = memory.getCompany("TestCorp");
    expect(company!.latestBuyingStage).toBe("evaluation");
  });

  it("retrieves top companies by signal count", () => {
    const memory = new CompanyMemory(TEST_DIR);

    // 3 signals for CompanyA
    memory.recordSignal(
      makeEvent({
        eventId: "evt_a1",
        company: { ...makeEvent().company, companyName: "CompanyA" },
      })
    );
    memory.recordSignal(
      makeEvent({
        eventId: "evt_a2",
        company: { ...makeEvent().company, companyName: "CompanyA" },
      })
    );
    memory.recordSignal(
      makeEvent({
        eventId: "evt_a3",
        company: { ...makeEvent().company, companyName: "CompanyA" },
      })
    );

    // 1 signal for CompanyB
    memory.recordSignal(
      makeEvent({
        eventId: "evt_b1",
        company: { ...makeEvent().company, companyName: "CompanyB" },
      })
    );

    const top = memory.getTopCompanies(2);
    expect(top).toHaveLength(2);
    expect(top[0].companyName).toBe("CompanyA");
    expect(top[0].signalCount).toBe(3);
  });

  it("adds notes to a company", () => {
    const memory = new CompanyMemory(TEST_DIR);
    memory.recordSignal(makeEvent());

    memory.addNote("TestCorp", "Met at conference");

    const company = memory.getCompany("TestCorp");
    expect(company!.notes).toHaveLength(1);
    expect(company!.notes[0]).toContain("Met at conference");
  });

  it("adds aliases to a company", () => {
    const memory = new CompanyMemory(TEST_DIR);
    memory.recordSignal(makeEvent());

    memory.addAlias("TestCorp", "TC");
    memory.addAlias("TestCorp", "Test Corporation");

    const company = memory.getCompany("TC");
    expect(company).toBeDefined();
    expect(company!.companyName).toBe("TestCorp");
  });

  it("case-insensitive company lookup", () => {
    const memory = new CompanyMemory(TEST_DIR);
    memory.recordSignal(makeEvent());

    expect(memory.getCompany("testcorp")).toBeDefined();
    expect(memory.getCompany("TESTCORP")).toBeDefined();
    expect(memory.getCompany("TestCorp")).toBeDefined();
  });

  it("persists across instances", () => {
    const memory1 = new CompanyMemory(TEST_DIR);
    memory1.recordSignal(makeEvent());

    const memory2 = new CompanyMemory(TEST_DIR);
    expect(memory2.size).toBe(1);
    expect(memory2.getCompany("TestCorp")).toBeDefined();
  });
});
