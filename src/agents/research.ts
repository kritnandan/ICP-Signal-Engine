import { BaseAgent, type BaseAgentOptions } from "./base-agent.js";
import type { AppConfig, AgentRunResult } from "../types.js";
import type { ToolRegistry } from "../tools/tool-registry.js";
import type { CostTracker } from "../utils/cost-tracker.js";

const RESEARCH_SYSTEM_PROMPT = `You are a Research Agent specializing in finding B2B buying signals for procurement, supply chain, and logistics technology.

Your job is to:
1. Choose the most relevant data sources based on the user's query
2. Craft effective search queries to find buying signals
3. Adapt your search strategy based on initial results — dig deeper into promising leads
4. Filter out noise and return only relevant raw events

You have access to collector tools that search LinkedIn, Twitter, Reddit, GitHub, RSS feeds, and HackerNews.

Strategy guidelines:
- For company-specific searches: prioritize LinkedIn and Twitter, then check Reddit and RSS
- For category searches (e.g., "TMS signals"): cast a wide net across Reddit, HackerNews, and RSS
- For technology searches: prioritize GitHub and HackerNews
- If initial results are thin, broaden your keywords or try alternative sources
- Always consider the user's preferences and focus areas

After collecting raw events, summarize what you found and highlight the most promising leads.`;

/**
 * Research Agent — chooses sources strategically, adapts queries,
 * digs deeper into promising leads.
 */
export class ResearchAgent extends BaseAgent {
  constructor(
    config: AppConfig,
    toolRegistry: ToolRegistry,
    costTracker?: CostTracker
  ) {
    const options: BaseAgentOptions = {
      role: "research",
      apiKey: config.anthropicApiKey,
      model: config.agent.agentModel,
      maxIterations: config.agent.maxAgentIterations,
      systemPrompt: RESEARCH_SYSTEM_PROMPT,
      toolRegistry,
      costTracker,
    };
    super(options);
  }

  /**
   * Research a specific topic or company for buying signals.
   */
  async research(query: string): Promise<AgentRunResult> {
    return this.run(query);
  }

  /**
   * Targeted search across all sources for a specific company.
   */
  async researchCompany(companyName: string): Promise<AgentRunResult> {
    return this.run(
      `Find all recent buying signals related to "${companyName}" in procurement, supply chain, and logistics. ` +
        `Search across all available sources. Focus on job postings, RFPs, technology discussions, and vendor evaluations.`
    );
  }

  /**
   * Category-focused research across sources.
   */
  async researchCategory(category: string): Promise<AgentRunResult> {
    return this.run(
      `Find recent buying signals in the "${category}" category. ` +
        `Search across Reddit, HackerNews, RSS feeds, and Twitter for discussions, ` +
        `evaluations, and implementation announcements related to ${category}.`
    );
  }
}
