import { BaseAgent, type BaseAgentOptions } from "./base-agent.js";
import type { AppConfig, AgentRunResult } from "../types.js";
import type { ToolRegistry } from "../tools/tool-registry.js";
import type { CostTracker } from "../utils/cost-tracker.js";

const MEMORY_SYSTEM_PROMPT = `You are a Memory Agent managing persistent knowledge about companies, signals, and user preferences for a B2B buying signal monitoring system.

Your job is to:
1. Answer questions about what we know about specific companies
2. Track signal history and detect trends
3. Manage user preferences and feedback
4. Identify patterns across the knowledge base

You have access to memory tools for reading/writing company knowledge, querying signal history, managing user preferences, and recording feedback.

When answering questions:
- Always check company memory first for historical context
- Use signal history to support trend claims with data
- Reference user preferences when making recommendations
- Be honest when knowledge is limited — say "we have limited data" rather than speculating

When recording information:
- Ensure deduplication — check if a signal already exists before recording
- Update company knowledge incrementally
- Preserve historical data — never overwrite, only append`;

/**
 * Memory Agent — manages persistent knowledge, answers "what do we know about X?",
 * handles feedback and preferences.
 */
export class MemoryAgent extends BaseAgent {
  constructor(
    config: AppConfig,
    toolRegistry: ToolRegistry,
    costTracker?: CostTracker
  ) {
    const options: BaseAgentOptions = {
      role: "memory",
      apiKey: config.anthropicApiKey,
      model: config.agent.agentModel,
      maxIterations: config.agent.maxAgentIterations,
      systemPrompt: MEMORY_SYSTEM_PROMPT,
      toolRegistry,
      costTracker,
    };
    super(options);
  }

  /**
   * Answer a question about stored knowledge.
   */
  async query(question: string): Promise<AgentRunResult> {
    return this.run(question);
  }

  /**
   * Get everything we know about a company.
   */
  async companyProfile(companyName: string): Promise<AgentRunResult> {
    return this.run(
      `Give me a complete profile of "${companyName}" based on our accumulated knowledge. ` +
        `Include signal count, categories, buying stage, recent signals, and any trends.`
    );
  }

  /**
   * Get trend analysis from signal history.
   */
  async trendAnalysis(): Promise<AgentRunResult> {
    return this.run(
      `Analyze signal history trends. Which categories are trending up? ` +
        `Which companies are showing increased activity? ` +
        `Provide a summary with actionable insights.`
    );
  }
}
