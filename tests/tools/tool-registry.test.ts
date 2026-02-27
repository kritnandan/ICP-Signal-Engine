import { describe, it, expect } from "vitest";
import { ToolRegistry, createToolRegistry } from "../../src/tools/tool-registry.js";

describe("ToolRegistry", () => {
  it("creates an empty registry", () => {
    const registry = createToolRegistry();
    expect(registry.size).toBe(0);
    expect(registry.listNames()).toEqual([]);
  });

  it("registers and retrieves a tool", () => {
    const registry = new ToolRegistry();

    registry.register(
      {
        name: "test_tool",
        description: "A test tool",
        input_schema: { type: "object", properties: {} },
      },
      async () => ({ result: "ok" })
    );

    expect(registry.size).toBe(1);
    expect(registry.listNames()).toContain("test_tool");

    const tool = registry.get("test_tool");
    expect(tool).toBeDefined();
    expect(tool!.definition.name).toBe("test_tool");
  });

  it("executes a registered tool", async () => {
    const registry = new ToolRegistry();

    registry.register(
      {
        name: "echo",
        description: "Echoes input",
        input_schema: {
          type: "object",
          properties: { message: { type: "string" } },
        },
      },
      async (input) => ({ echoed: input.message })
    );

    const result = await registry.execute("echo", {
      message: "hello",
    });
    expect(result).toEqual({ echoed: "hello" });
  });

  it("throws when executing unknown tool", async () => {
    const registry = new ToolRegistry();

    await expect(
      registry.execute("nonexistent", {})
    ).rejects.toThrow('Tool "nonexistent" not found');
  });

  it("filters tools by role", () => {
    const registry = new ToolRegistry();

    registry.register(
      {
        name: "research_only",
        description: "Research tool",
        input_schema: { type: "object", properties: {} },
        roles: ["research"],
      },
      async () => ({})
    );

    registry.register(
      {
        name: "analysis_only",
        description: "Analysis tool",
        input_schema: { type: "object", properties: {} },
        roles: ["analysis"],
      },
      async () => ({})
    );

    registry.register(
      {
        name: "shared_tool",
        description: "Shared across all roles",
        input_schema: { type: "object", properties: {} },
        // No roles = available to all
      },
      async () => ({})
    );

    const researchTools = registry.getForRole("research");
    expect(researchTools.map((t) => t.name)).toContain("research_only");
    expect(researchTools.map((t) => t.name)).toContain("shared_tool");
    expect(researchTools.map((t) => t.name)).not.toContain("analysis_only");

    const analysisTools = registry.getForRole("analysis");
    expect(analysisTools.map((t) => t.name)).toContain("analysis_only");
    expect(analysisTools.map((t) => t.name)).toContain("shared_tool");
    expect(analysisTools.map((t) => t.name)).not.toContain("research_only");
  });

  it("getAll returns all registered tools", () => {
    const registry = new ToolRegistry();

    registry.register(
      {
        name: "tool_a",
        description: "A",
        input_schema: { type: "object", properties: {} },
        roles: ["research"],
      },
      async () => ({})
    );
    registry.register(
      {
        name: "tool_b",
        description: "B",
        input_schema: { type: "object", properties: {} },
        roles: ["analysis"],
      },
      async () => ({})
    );

    const all = registry.getAll();
    expect(all).toHaveLength(2);
    expect(all.map((t) => t.name)).toEqual(["tool_a", "tool_b"]);
  });

  it("overwrites existing tool with same name", () => {
    const registry = new ToolRegistry();

    registry.register(
      {
        name: "tool",
        description: "Version 1",
        input_schema: { type: "object", properties: {} },
      },
      async () => ({ version: 1 })
    );

    registry.register(
      {
        name: "tool",
        description: "Version 2",
        input_schema: { type: "object", properties: {} },
      },
      async () => ({ version: 2 })
    );

    expect(registry.size).toBe(1);
    expect(registry.get("tool")!.definition.description).toBe(
      "Version 2"
    );
  });
});
