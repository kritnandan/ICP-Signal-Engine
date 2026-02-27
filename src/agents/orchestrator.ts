import Anthropic from "@anthropic-ai/sdk";
import type {
  AppConfig,
  AgentRunResult,
  ConversationContext,
  TokenUsage,
  ReActStep,
} from "../types.js";
import type { ToolRegistry } from "../tools/tool-registry.js";
import { ResearchAgent } from "./research.js";
import { AnalysisAgent } from "./analysis.js";
import { MemoryAgent } from "./memory-agent.js";
import { CostTracker } from "../utils/cost-tracker.js";
import { logger } from "../utils/logger.js";

const ORCHESTRATOR_SYSTEM_PROMPT = `You are the Orchestrator Agent for an ICP Buying Signal Monitor — a system that finds B2B buying signals for procurement, supply chain, and logistics technology.

You are the user's primary interface. You:
1. Understand the user's natural language requests
2. Plan which agents and tools to use
3. Delegate work to specialized agents
4. Synthesize results into clear, actionable responses
5. Ask for clarification when the request is ambiguous

You have access to all tools directly, but for complex tasks you should delegate:
- Use collector tools (search_*) for quick lookups
- Use analysis tools (match_icp_profile, classify_signal) for quick classification
- Use memory tools for knowledge queries

For complex multi-step tasks, combine tools strategically:
1. Check memory for existing knowledge
2. Collect new data from relevant sources
3. Analyze and classify findings
4. Cross-reference with history
5. Generate a clear summary

Communication style:
- Be concise but thorough
- Lead with key findings
- Provide confidence levels
- Suggest next actions
- When uncertain, say so and ask the user

Always consider user preferences when filtering and presenting results.`;

/**
 * Orchestrator Agent — the brain that receives user goals, plans which
 * agents/tools to use, delegates, synthesizes, and replans when needed.
 */
export class OrchestratorAgent {
  private client: Anthropic;
  private config: AppConfig;
  private toolRegistry: ToolRegistry;
  private costTracker: CostTracker;
  private researchAgent: ResearchAgent;
  private analysisAgent: AnalysisAgent;
  private memoryAgent: MemoryAgent;
  private context: ConversationContext;

  constructor(config: AppConfig, toolRegistry: ToolRegistry) {
    this.client = new Anthropic({ apiKey: config.anthropicApiKey });
    this.config = config;
    this.toolRegistry = toolRegistry;
    this.costTracker = new CostTracker();

    this.researchAgent = new ResearchAgent(
      config,
      toolRegistry,
      this.costTracker
    );
    this.analysisAgent = new AnalysisAgent(
      config,
      toolRegistry,
      this.costTracker
    );
    this.memoryAgent = new MemoryAgent(
      config,
      toolRegistry,
      this.costTracker
    );

    this.context = { turns: [] };
  }

  /**
   * Process a user message through the orchestrator.
   * Maintains conversation context across calls.
   */
  async chat(userMessage: string): Promise<AgentRunResult> {
    const startTime = Date.now();
    const steps: ReActStep[] = [];
    const totalUsage: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };

    // Add user turn to context
    this.context.turns.push({
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString(),
    });

    // Build messages from conversation context
    const messages: Anthropic.MessageParam[] = this.context.turns.map(
      (turn) => ({
        role: turn.role,
        content: turn.content,
      })
    );

    // Get available tools
    const tools = this.toolRegistry.getForRole("orchestrator");
    const anthropicTools: Anthropic.Tool[] = [
      // Agent delegation tools
      {
        name: "delegate_research",
        description:
          "Delegate a research task to the Research Agent. It will autonomously search across sources and return findings. Use for broad data collection tasks.",
        input_schema: {
          type: "object" as const,
          properties: {
            query: {
              type: "string",
              description: "What to research",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "delegate_analysis",
        description:
          "Delegate analysis to the Analysis Agent. It will classify signals, cross-reference, and reflect. Pass raw events as JSON.",
        input_schema: {
          type: "object" as const,
          properties: {
            eventsJson: {
              type: "string",
              description: "JSON string of raw events to analyze",
            },
          },
          required: ["eventsJson"],
        },
      },
      {
        name: "delegate_memory_query",
        description:
          "Delegate a knowledge query to the Memory Agent. Use for 'what do we know about X?' questions.",
        input_schema: {
          type: "object" as const,
          properties: {
            question: {
              type: "string",
              description: "Question about stored knowledge",
            },
          },
          required: ["question"],
        },
      },
      // Direct tools
      ...tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Tool["input_schema"],
      })),
    ];

    let finalResponse = "";
    const maxIterations = this.config.agent.maxAgentIterations;

    for (let i = 0; i < maxIterations; i++) {
      logger.debug(
        `[orchestrator] Iteration ${i + 1}/${maxIterations}`
      );

      const response = await this.client.messages.create({
        model: this.config.agent.agentModel,
        max_tokens: 4096,
        system: ORCHESTRATOR_SYSTEM_PROMPT,
        tools: anthropicTools,
        messages,
      });

      totalUsage.inputTokens += response.usage.input_tokens;
      totalUsage.outputTokens += response.usage.output_tokens;
      totalUsage.totalTokens +=
        response.usage.input_tokens + response.usage.output_tokens;

      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === "text"
      );
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      const thought = textBlocks.map((b) => b.text).join("\n");

      if (toolUseBlocks.length === 0) {
        finalResponse = thought;
        steps.push({
          iteration: i + 1,
          thought,
          timestamp: new Date().toISOString(),
        });
        break;
      }

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
          let result: unknown;
          const input = toolUse.input as Record<string, unknown>;

          // Handle delegation to sub-agents
          if (toolUse.name === "delegate_research") {
            const agentResult = await this.researchAgent.research(
              input.query as string
            );
            result = {
              response: agentResult.finalResponse,
              steps: agentResult.steps.length,
              tokens: agentResult.tokenUsage.totalTokens,
            };
          } else if (toolUse.name === "delegate_analysis") {
            const agentResult = await this.analysisAgent.analyze(
              input.eventsJson as string
            );
            result = {
              response: agentResult.finalResponse,
              steps: agentResult.steps.length,
              tokens: agentResult.tokenUsage.totalTokens,
            };
          } else if (toolUse.name === "delegate_memory_query") {
            const agentResult = await this.memoryAgent.query(
              input.question as string
            );
            result = {
              response: agentResult.finalResponse,
              steps: agentResult.steps.length,
              tokens: agentResult.tokenUsage.totalTokens,
            };
          } else {
            // Direct tool execution
            result = await this.toolRegistry.execute(
              toolUse.name,
              input
            );
          }

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
            `[orchestrator] Tool ${toolUse.name} failed: ${errMsg}`
          );
        }

        steps.push(step);
      }

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
    }

    // Add assistant response to context
    this.context.turns.push({
      role: "assistant",
      content: finalResponse,
      timestamp: new Date().toISOString(),
    });

    this.costTracker.addUsage("orchestrator", totalUsage);

    const durationMs = Date.now() - startTime;
    logger.info(
      `[orchestrator] Completed in ${durationMs}ms (${totalUsage.totalTokens} tokens)`
    );

    return {
      agentRole: "orchestrator",
      finalResponse,
      steps,
      tokenUsage: totalUsage,
      durationMs,
    };
  }

  /**
   * One-shot question — no conversation context maintained.
   */
  async ask(question: string): Promise<AgentRunResult> {
    // Reset context for one-shot
    const savedContext = this.context;
    this.context = { turns: [] };
    const result = await this.chat(question);
    this.context = savedContext;
    return result;
  }

  getConversationContext(): ConversationContext {
    return this.context;
  }

  resetConversation(): void {
    this.context = { turns: [] };
  }

  getCostTracker(): CostTracker {
    return this.costTracker;
  }
}
