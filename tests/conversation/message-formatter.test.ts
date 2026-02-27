import { describe, it, expect } from "vitest";
import {
  formatSignalEvent,
  formatSignalTable,
  formatCompanyProfile,
  formatAgentResult,
  formatWelcome,
  formatHelp,
  formatStatus,
} from "../../src/conversation/message-formatter.js";
import type {
  BuyingSignalEvent,
  CompanyKnowledge,
  AgentRunResult,
} from "../../src/types.js";

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
      confidence: 0.85,
      category: "tms_logistics",
      strength: "strong",
      buyingStage: "research",
      reasoning: "Active TMS research with vendor evaluation.",
      keywords: ["TMS", "freight"],
      suggestedActions: ["Reach out with case studies"],
    },
    rawContent: {
      title: "Looking for TMS recommendations",
      body: "We need a new TMS...",
    },
    pipeline: {
      collectedAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      pipelineVersion: "1.0.0",
    },
    ...overrides,
  };
}

describe("Message Formatter", () => {
  describe("formatSignalEvent", () => {
    it("formats a signal event with company and strength", () => {
      const output = formatSignalEvent(makeEvent());

      expect(output).toContain("TestCorp");
      expect(output).toContain("STRONG");
      expect(output).toContain("tms_logistics");
      expect(output).toContain("85%");
      expect(output).toContain("research");
      expect(output).toContain("reddit");
    });

    it("includes title when present", () => {
      const output = formatSignalEvent(makeEvent());
      expect(output).toContain("Looking for TMS recommendations");
    });
  });

  describe("formatSignalTable", () => {
    it("returns 'no signals' for empty array", () => {
      const output = formatSignalTable([]);
      expect(output).toContain("No signals found");
    });

    it("groups signals by strength", () => {
      const events = [
        makeEvent({ signal: { ...makeEvent().signal, strength: "strong" } }),
        makeEvent({
          eventId: "evt_002",
          signal: { ...makeEvent().signal, strength: "moderate" },
        }),
        makeEvent({
          eventId: "evt_003",
          signal: { ...makeEvent().signal, strength: "weak" },
        }),
      ];

      const output = formatSignalTable(events);
      expect(output).toContain("STRONG (1)");
      expect(output).toContain("MODERATE (1)");
      expect(output).toContain("WEAK (1)");
    });
  });

  describe("formatCompanyProfile", () => {
    it("formats a company profile with all fields", () => {
      const company: CompanyKnowledge = {
        companyName: "TestCorp",
        aliases: ["TC", "Test Corporation"],
        signalCount: 5,
        categories: {
          tms_logistics: 3,
          procurement_sourcing: 2,
        },
        latestBuyingStage: "evaluation",
        firstSeenAt: "2025-01-01T00:00:00Z",
        lastSeenAt: "2025-02-01T00:00:00Z",
        notes: ["Met at conference"],
        signalIds: ["evt_1", "evt_2"],
      };

      const output = formatCompanyProfile(company);
      expect(output).toContain("TestCorp");
      expect(output).toContain("TC, Test Corporation");
      expect(output).toContain("5");
      expect(output).toContain("evaluation");
      expect(output).toContain("tms_logistics");
      expect(output).toContain("Met at conference");
    });
  });

  describe("formatAgentResult", () => {
    it("formats agent result with metadata", () => {
      const result: AgentRunResult = {
        agentRole: "orchestrator",
        finalResponse: "Found 3 strong signals.",
        steps: [
          {
            iteration: 1,
            thought: "Searching...",
            timestamp: new Date().toISOString(),
          },
        ],
        tokenUsage: {
          inputTokens: 500,
          outputTokens: 200,
          totalTokens: 700,
        },
        durationMs: 3500,
      };

      const output = formatAgentResult(result);
      expect(output).toContain("Found 3 strong signals.");
      expect(output).toContain("orchestrator");
      expect(output).toContain("700 tokens");
      expect(output).toContain("3.5s");
    });
  });

  describe("formatWelcome", () => {
    it("includes key information", () => {
      const output = formatWelcome();
      expect(output).toContain("ICP Buying Signal Monitor");
      expect(output).toContain("Agentic Mode");
      expect(output).toContain("/help");
      expect(output).toContain("/quit");
    });
  });

  describe("formatHelp", () => {
    it("lists all available commands", () => {
      const output = formatHelp();
      expect(output).toContain("/help");
      expect(output).toContain("/status");
      expect(output).toContain("/companies");
      expect(output).toContain("/history");
      expect(output).toContain("/feedback");
      expect(output).toContain("/export");
      expect(output).toContain("/quit");
    });
  });

  describe("formatStatus", () => {
    it("displays system metrics", () => {
      const output = formatStatus(
        { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
        5,
        10,
        25
      );

      expect(output).toContain("1500");
      expect(output).toContain("5");
      expect(output).toContain("10");
      expect(output).toContain("25");
    });
  });
});
