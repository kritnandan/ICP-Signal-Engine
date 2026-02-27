import { describe, it, expect, vi, beforeEach } from "vitest";
import { BaseAgent } from "../../src/agents/base-agent.js";
import { ToolRegistry } from "../../src/tools/tool-registry.js";
import { CostTracker } from "../../src/utils/cost-tracker.js";

// Mock the Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn(),
      },
    })),
  };
});

function createMockAgent(mockCreate: ReturnType<typeof vi.fn>) {
  const registry = new ToolRegistry();

  // Register a test tool
  registry.register(
    {
      name: "test_tool",
      description: "A test tool",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string" },
        },
        required: ["query"],
      },
    },
    async (input) => ({
      result: `processed: ${input.query}`,
    })
  );

  const agent = new BaseAgent({
    role: "orchestrator",
    apiKey: "test-key",
    model: "claude-sonnet-4-6",
    maxIterations: 5,
    systemPrompt: "You are a test agent.",
    toolRegistry: registry,
    costTracker: new CostTracker(),
  });

  // Override the client
  (agent as unknown as { client: { messages: { create: typeof mockCreate } } }).client = {
    messages: { create: mockCreate },
  };

  return agent;
}

describe("BaseAgent", () => {
  it("returns final text response when no tools are used", async () => {
    const mockCreate = vi.fn().mockResolvedValueOnce({
      content: [{ type: "text", text: "Hello, I can help you!" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 50, output_tokens: 20 },
    });

    const agent = createMockAgent(mockCreate);
    const result = await agent.run("Hello");

    expect(result.agentRole).toBe("orchestrator");
    expect(result.finalResponse).toBe("Hello, I can help you!");
    expect(result.steps).toHaveLength(1);
    expect(result.tokenUsage.totalTokens).toBe(70);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("executes tool calls and continues the loop", async () => {
    const mockCreate = vi
      .fn()
      // First call: model wants to use a tool
      .mockResolvedValueOnce({
        content: [
          { type: "text", text: "Let me search for that." },
          {
            type: "tool_use",
            id: "call_1",
            name: "test_tool",
            input: { query: "supply chain" },
          },
        ],
        stop_reason: "tool_use",
        usage: { input_tokens: 100, output_tokens: 50 },
      })
      // Second call: model gives final response
      .mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: "Found results for supply chain.",
          },
        ],
        stop_reason: "end_turn",
        usage: { input_tokens: 200, output_tokens: 30 },
      });

    const agent = createMockAgent(mockCreate);
    const result = await agent.run("Search for supply chain signals");

    expect(result.finalResponse).toBe(
      "Found results for supply chain."
    );
    expect(result.steps.length).toBeGreaterThanOrEqual(2);
    expect(result.tokenUsage.totalTokens).toBe(380);

    // Check tool was called
    const toolStep = result.steps.find((s) => s.toolName === "test_tool");
    expect(toolStep).toBeDefined();
    expect(toolStep!.toolResult).toEqual({
      result: "processed: supply chain",
    });
  });

  it("handles tool execution errors gracefully", async () => {
    const registry = new ToolRegistry();
    registry.register(
      {
        name: "failing_tool",
        description: "A tool that fails",
        input_schema: { type: "object", properties: {} },
      },
      async () => {
        throw new Error("Tool execution failed");
      }
    );

    const mockCreate = vi
      .fn()
      .mockResolvedValueOnce({
        content: [
          {
            type: "tool_use",
            id: "call_1",
            name: "failing_tool",
            input: {},
          },
        ],
        stop_reason: "tool_use",
        usage: { input_tokens: 50, output_tokens: 20 },
      })
      .mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: "The tool failed, but I can try another approach.",
          },
        ],
        stop_reason: "end_turn",
        usage: { input_tokens: 100, output_tokens: 30 },
      });

    const agent = new BaseAgent({
      role: "orchestrator",
      apiKey: "test-key",
      model: "claude-sonnet-4-6",
      maxIterations: 5,
      systemPrompt: "Test",
      toolRegistry: registry,
    });

    (agent as unknown as { client: { messages: { create: typeof mockCreate } } }).client = {
      messages: { create: mockCreate },
    };

    const result = await agent.run("Try the failing tool");

    const errorStep = result.steps.find((s) => s.isError);
    expect(errorStep).toBeDefined();
    expect(errorStep!.toolResult).toEqual({
      error: "Tool execution failed",
    });
  });

  it("respects max iterations limit", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [
        {
          type: "tool_use",
          id: "call_loop",
          name: "test_tool",
          input: { query: "loop" },
        },
      ],
      stop_reason: "tool_use",
      usage: { input_tokens: 50, output_tokens: 20 },
    });

    const agent = createMockAgent(mockCreate);
    // Override max iterations to 3
    (agent as unknown as { maxIterations: number }).maxIterations = 3;

    const result = await agent.run("Keep looping");

    // Should stop after 3 iterations even though model keeps requesting tools
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });
});
