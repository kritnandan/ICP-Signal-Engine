import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { OutputWriter } from "../src/output/writer.js";
import type { BuyingSignalEvent } from "../src/types.js";

function makeBuyingSignalEvent(
  overrides: Partial<BuyingSignalEvent> = {}
): BuyingSignalEvent {
  return {
    eventId: "evt_test_abc123",
    timestamp: new Date().toISOString(),
    source: {
      platform: "linkedin",
      contentType: "company_post",
      url: "https://linkedin.com/feed/update/123",
      author: "Jane Doe",
      authorRole: "VP Supply Chain",
    },
    company: {
      companyName: "AcmeCorp",
      matchScore: 0.85,
      matchedCriteria: ["target_role", "content_relevance_high"],
      unmatchedCriteria: ["industry_signal"],
    },
    signal: {
      isSignal: true,
      confidence: 0.9,
      category: "planning_visibility",
      strength: "strong",
      buyingStage: "research",
      reasoning: "Explicit interest in supply chain visibility solutions.",
      keywords: ["supply chain", "visibility", "resilience"],
      suggestedActions: ["Send case study on control tower solutions"],
    },
    rawContent: {
      title: "Supply chain overhaul",
      body: "We're overhauling our global supply chain to improve resilience and visibility in 2026.",
      publishedAt: new Date().toISOString(),
    },
    pipeline: {
      collectedAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      pipelineVersion: "1.0.0",
    },
    ...overrides,
  };
}

describe("OutputWriter", () => {
  let tmpDir: string;
  let writer: OutputWriter;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "icp-test-"));
    writer = new OutputWriter(tmpDir);
  });

  it("writes individual event files", () => {
    const event = makeBuyingSignalEvent();
    writer.writeEvent(event);

    const eventFile = join(tmpDir, "events", `${event.eventId}.json`);
    expect(existsSync(eventFile)).toBe(true);

    const written = JSON.parse(readFileSync(eventFile, "utf-8"));
    expect(written.eventId).toBe(event.eventId);
    expect(written.company.companyName).toBe("AcmeCorp");
  });

  it("writes batch JSONL files", () => {
    const events = [
      makeBuyingSignalEvent({ eventId: "evt_batch_001" }),
      makeBuyingSignalEvent({ eventId: "evt_batch_002" }),
    ];

    const outputFile = writer.writeBatch(events, "run_test_123");
    expect(existsSync(outputFile)).toBe(true);

    const lines = readFileSync(outputFile, "utf-8").trim().split("\n");
    expect(lines.length).toBe(2);

    const parsed = JSON.parse(lines[0]);
    expect(parsed.eventId).toBe("evt_batch_001");
  });

  it("writes latest.json summary", () => {
    const events = [
      makeBuyingSignalEvent(),
      makeBuyingSignalEvent({
        eventId: "evt_test_002",
        signal: {
          isSignal: true,
          confidence: 0.7,
          category: "tms_logistics",
          strength: "moderate",
          buyingStage: "evaluation",
          reasoning: "TMS evaluation in progress.",
          keywords: ["TMS"],
          suggestedActions: ["Demo request"],
        },
      }),
    ];

    writer.writeBatch(events, "run_latest");

    const latestPath = join(tmpDir, "latest.json");
    expect(existsSync(latestPath)).toBe(true);

    const latest = JSON.parse(readFileSync(latestPath, "utf-8"));
    expect(latest.totalEvents).toBe(2);
    expect(latest.signalCount).toBe(2);
    expect(latest.byCategory).toHaveProperty("planning_visibility");
  });

  // Cleanup
  it.each([["cleanup"]])("%s", () => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup failures
    }
  });
});
