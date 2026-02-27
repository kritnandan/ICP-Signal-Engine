import { describe, it, expect, vi } from "vitest";
import { OrchestratorAgent } from "../../src/agents/orchestrator.js";
import { ToolRegistry } from "../../src/tools/tool-registry.js";
import type { AppConfig } from "../../src/types.js";

// Mock Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: "text",
              text: "I found 3 buying signals from manufacturing companies.",
            },
          ],
          stop_reason: "end_turn",
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
      },
    })),
  };
});

function createTestConfig(): AppConfig {
  return {
    anthropicApiKey: "test-key",
    outputDir: "./test-output",
    logLevel: "error",
    cronSchedule: "0 */4 * * *",
    icpConfigPath: "./config/icp.json",
    signalConfidenceThreshold: 0.6,
    maxEventsPerRun: 100,
    agent: {
      agentMode: true,
      memoryDir: "./test-data/memory",
      agentModel: "claude-sonnet-4-6",
      maxAgentIterations: 5,
      enableReflection: true,
      enableMemory: true,
    },
    collectors: {
      linkedin: { enabled: false, companyIds: [], keywords: [] },
      twitter: { enabled: false, accounts: [], keywords: [] },
      reddit: {
        enabled: false,
        userAgent: "test",
        subreddits: [],
      },
      github: { enabled: false, repos: [], keywords: [] },
      rss: { enabled: false, feeds: [] },
    },
  };
}

describe("OrchestratorAgent", () => {
  it("creates with correct configuration", () => {
    const config = createTestConfig();
    const registry = new ToolRegistry();
    const orchestrator = new OrchestratorAgent(config, registry);

    expect(orchestrator).toBeDefined();
    expect(orchestrator.getConversationContext().turns).toHaveLength(0);
  });

  it("processes a chat message and returns result", async () => {
    const config = createTestConfig();
    const registry = new ToolRegistry();
    const orchestrator = new OrchestratorAgent(config, registry);

    const result = await orchestrator.chat(
      "Find TMS signals from manufacturing"
    );

    expect(result.agentRole).toBe("orchestrator");
    expect(result.finalResponse).toContain("buying signals");
    expect(result.tokenUsage.totalTokens).toBeGreaterThan(0);
  });

  it("maintains conversation context across chat calls", async () => {
    const config = createTestConfig();
    const registry = new ToolRegistry();
    const orchestrator = new OrchestratorAgent(config, registry);

    await orchestrator.chat("Hello");
    const context = orchestrator.getConversationContext();

    expect(context.turns).toHaveLength(2); // user + assistant
    expect(context.turns[0].role).toBe("user");
    expect(context.turns[1].role).toBe("assistant");
  });

  it("ask() does not modify persistent conversation context", async () => {
    const config = createTestConfig();
    const registry = new ToolRegistry();
    const orchestrator = new OrchestratorAgent(config, registry);

    await orchestrator.chat("First message");
    const turnsBefore = orchestrator.getConversationContext().turns.length;

    await orchestrator.ask("One-shot question");
    const turnsAfter = orchestrator.getConversationContext().turns.length;

    expect(turnsAfter).toBe(turnsBefore);
  });

  it("resetConversation clears all turns", async () => {
    const config = createTestConfig();
    const registry = new ToolRegistry();
    const orchestrator = new OrchestratorAgent(config, registry);

    await orchestrator.chat("Hello");
    expect(
      orchestrator.getConversationContext().turns.length
    ).toBeGreaterThan(0);

    orchestrator.resetConversation();
    expect(orchestrator.getConversationContext().turns).toHaveLength(
      0
    );
  });

  it("getCostTracker returns tracker with usage data", async () => {
    const config = createTestConfig();
    const registry = new ToolRegistry();
    const orchestrator = new OrchestratorAgent(config, registry);

    await orchestrator.chat("Test message");

    const tracker = orchestrator.getCostTracker();
    const usage = tracker.getTotalUsage();
    expect(usage.totalTokens).toBeGreaterThan(0);
  });
});
