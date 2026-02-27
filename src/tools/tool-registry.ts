import type { AgentRole, AgentToolDefinition } from "../types.js";
import { logger } from "../utils/logger.js";

export type ToolHandler = (
  input: Record<string, unknown>
) => Promise<unknown>;

interface RegisteredTool {
  definition: AgentToolDefinition;
  handler: ToolHandler;
}

/**
 * Central tool registration and lookup.
 * Agents request tools by role; the registry returns only tools available to that role.
 */
export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();

  register(
    definition: AgentToolDefinition,
    handler: ToolHandler
  ): void {
    if (this.tools.has(definition.name)) {
      logger.warn(`Tool "${definition.name}" already registered, overwriting`);
    }
    this.tools.set(definition.name, { definition, handler });
    logger.debug(`Registered tool: ${definition.name}`);
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  getAll(): AgentToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  getForRole(role: AgentRole): AgentToolDefinition[] {
    return Array.from(this.tools.values())
      .filter(
        (t) => !t.definition.roles || t.definition.roles.includes(role)
      )
      .map((t) => t.definition);
  }

  async execute(
    name: string,
    input: Record<string, unknown>
  ): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool "${name}" not found in registry`);
    }
    return tool.handler(input);
  }

  get size(): number {
    return this.tools.size;
  }

  listNames(): string[] {
    return Array.from(this.tools.keys());
  }
}

/**
 * Factory to create and populate a ToolRegistry with all available tools.
 */
export function createToolRegistry(): ToolRegistry {
  return new ToolRegistry();
}
