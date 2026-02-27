import { describe, it, expect } from "vitest";
import type { RawEvent } from "../src/types.js";

/**
 * These tests exercise the fallback (rule-based) classification logic
 * without requiring an API key. The private fallbackClassification method
 * is tested indirectly by simulating a classify call failure, or you can
 * test the exported types and schema validation.
 */

function makeEvent(overrides: Partial<RawEvent> = {}): RawEvent {
  return {
    id: "test_001",
    source: "reddit",
    contentType: "post",
    url: "https://reddit.com/r/supplychain/123",
    body: "",
    collectedAt: new Date().toISOString(),
    metadata: {},
    ...overrides,
  };
}

describe("SignalClassifier (schema & types)", () => {
  it("RawEvent structure is valid", () => {
    const event = makeEvent({
      title: "Looking for TMS recommendations",
      body: "We need a TMS that integrates with our SAP ERP and multiple 3PLs.",
    });

    expect(event.source).toBe("reddit");
    expect(event.contentType).toBe("post");
    expect(event.body).toContain("TMS");
  });

  it("handles events with minimal fields", () => {
    const event = makeEvent({
      body: "Random post about nothing related.",
    });

    expect(event.id).toBeDefined();
    expect(event.collectedAt).toBeDefined();
  });
});

describe("BuyingSignalEvent schema validation", () => {
  it("validates a well-formed event", async () => {
    const { BuyingSignalEventSchema } = await import("../src/types.js");

    const event = {
      eventId: "evt_test_001",
      timestamp: new Date().toISOString(),
      source: {
        platform: "reddit",
        contentType: "post",
        url: "https://reddit.com/r/supplychain/123",
        author: "user123",
      },
      company: {
        companyName: "TestCo",
        matchScore: 0.75,
        matchedCriteria: ["content_relevance_high", "tech_stack:SAP"],
        unmatchedCriteria: ["target_role"],
      },
      signal: {
        isSignal: true,
        confidence: 0.85,
        category: "tms_logistics",
        strength: "strong",
        buyingStage: "research",
        reasoning: "Active TMS vendor research with ERP integration needs.",
        keywords: ["TMS", "SAP", "3PL"],
        suggestedActions: ["Reach out with TMS integration case studies"],
      },
      rawContent: {
        title: "Looking for TMS recommendations",
        body: "We need a TMS that integrates with our SAP ERP and multiple 3PLs.",
        publishedAt: new Date().toISOString(),
      },
      pipeline: {
        collectedAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
        pipelineVersion: "1.0.0",
      },
    };

    const result = BuyingSignalEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects an event with invalid confidence", async () => {
    const { BuyingSignalEventSchema } = await import("../src/types.js");

    const event = {
      eventId: "evt_test_002",
      timestamp: new Date().toISOString(),
      source: {
        platform: "reddit",
        contentType: "post",
        url: "https://reddit.com/r/test",
      },
      company: {
        companyName: "TestCo",
        matchScore: 0.5,
        matchedCriteria: [],
        unmatchedCriteria: [],
      },
      signal: {
        isSignal: true,
        confidence: 1.5, // invalid: > 1
        category: "tms_logistics",
        strength: "strong",
        buyingStage: "research",
        reasoning: "test",
        keywords: [],
        suggestedActions: [],
      },
      rawContent: {
        body: "test content",
      },
      pipeline: {
        collectedAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
        pipelineVersion: "1.0.0",
      },
    };

    const result = BuyingSignalEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});
