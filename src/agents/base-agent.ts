import Anthropic from "@anthropic-ai/sdk";
import type {
  AgentRole,
  AgentRunResult,
  ReActStep,
  TokenUsage,
} from "../types.js";
import { logger } from "../utils/logger.js";
import type { ToolRegistry } from "../tools/tool-registry.js";
import { CostTracker } from "../utils/cost-tracker.js";

export interface BaseAgentOptions {
  role: AgentRole;
  apiKey: string;
  model: string;
  maxIterations: number;
  systemPrompt: string;
  toolRegistry: ToolRegistry;
  costTracker?: CostTracker;
}

/**
 * Core ReAct loop agent using Anthropic tool-use API.
 *
 * Flow: User message → Model responds with thought + tool_use →
 * Execute tool → Return tool_result → Loop until end_turn.
 */
export class BaseAgent {
  protected role: AgentRole;
  protected client: Anthropic;
  protected model: string;
  protected maxIterations: number;
  protected systemPrompt: string;
  protected toolRegistry: ToolRegistry;
  protected costTracker: CostTracker;

  constructor(options: BaseAgentOptions) {
    this.role = options.role;
    this.client = new Anthropic({ apiKey: options.apiKey });
    this.model = options.model;
    this.maxIterations = options.maxIterations;
    this.systemPrompt = options.systemPrompt;
    this.toolRegistry = options.toolRegistry;
    this.costTracker = options.costTracker ?? new CostTracker();
  }

  async run(userMessage: string): Promise<AgentRunResult> {
    const startTime = Date.now();
    const steps: ReActStep[] = [];
    const totalUsage: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };

    const tools = this.toolRegistry.getForRole(this.role);
    const anthropicTools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Anthropic.Tool["input_schema"],
    }));

    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: userMessage },
    ];

    let finalResponse = "";

    for (let i = 0; i < this.maxIterations; i++) {
      logger.debug(`[${this.role}] Iteration ${i + 1}/${this.maxIterations}`);

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: this.systemPrompt,
        tools: anthropicTools.length > 0 ? anthropicTools : undefined,
        messages,
      });

      // Track token usage
      totalUsage.inputTokens += response.usage.input_tokens;
      totalUsage.outputTokens += response.usage.output_tokens;
      totalUsage.totalTokens +=
        response.usage.input_tokens + response.usage.output_tokens;

      // Extract text blocks and tool_use blocks
      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === "text"
      );
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      const thought = textBlocks.map((b) => b.text).join("\n");

      // If no tool use, this is the final response
      if (toolUseBlocks.length === 0) {
        finalResponse = thought;
        steps.push({
          iteration: i + 1,
          thought,
          timestamp: new Date().toISOString(),
        });
        break;
      }

      // Execute each tool call
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        const step: ReActStep = {
          iteration: i + 1,
          thought: thought || undefined,
          toolName: toolUse.name,
          toolInput: toolUse.input as Record<string, unknown>,
          timestamp: new Date().toISOString(),
        };

        try {
          logger.debug(
            `[${this.role}] Calling tool: ${toolUse.name}`
          );
          const result = await this.toolRegistry.execute(
            toolUse.name,
            toolUse.input as Record<string, unknown>
          );
          step.toolResult = result;
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          });
        } catch (err) {
          const errMsg =
            err instanceof Error ? err.message : String(err);
          step.toolResult = { error: errMsg };
          step.isError = true;
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify({ error: errMsg }),
            is_error: true,
          });
          logger.warn(
            `[${this.role}] Tool ${toolUse.name} failed: ${errMsg}`
          );
        }

        steps.push(step);
      }

      // Add assistant message and tool results to conversation
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });

      // If stop reason is end_turn, we're done
      if (response.stop_reason === "end_turn" && toolUseBlocks.length === 0) {
        break;
      }
    }

    // Track costs
    this.costTracker.addUsage(this.role, totalUsage);

    const durationMs = Date.now() - startTime;
    logger.info(
      `[${this.role}] Completed in ${durationMs}ms (${totalUsage.totalTokens} tokens)`
    );

    return {
      agentRole: this.role,
      finalResponse,
      steps,
      tokenUsage: totalUsage,
      durationMs,
    };
  }
}
