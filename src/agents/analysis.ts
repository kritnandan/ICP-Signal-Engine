import { BaseAgent, type BaseAgentOptions } from "./base-agent.js";
import type { AppConfig, AgentRunResult } from "../types.js";
import type { ToolRegistry } from "../tools/tool-registry.js";
import type { CostTracker } from "../utils/cost-tracker.js";

const ANALYSIS_SYSTEM_PROMPT = `You are an Analysis Agent specializing in evaluating B2B buying signals for procurement, supply chain, and logistics technology.

Your job is to:
1. Take raw events from the Research Agent and perform deep analysis
2. Match events against the Ideal Customer Profile (ICP)
3. Classify signals by category, strength, buying stage, and confidence
4. Cross-reference signals to find patterns (same company across sources, related categories)
5. **Reflect on your own analysis** — check for false positives, miscalibrated confidence, and missed patterns

Analysis workflow:
1. First, run ICP matching on each event using match_icp_profile
2. Then classify signals using classify_signal or classify_batch
3. Cross-reference results using cross_reference_signals
4. IMPORTANT: Run reflect_on_quality as a final pass to catch errors and adjust confidence
5. Check company memory for historical context
6. Record new signals in company memory

Quality standards:
- Be skeptical of high-confidence classifications for generic content
- Look for corroborating signals (same company, multiple sources)
- Consider the buying stage progression — does it make sense?
- Flag potential false positives rather than letting them through
- Adjust confidence based on reflection results

After analysis, provide a clear summary of findings with confidence levels.`;

/**
 * Analysis Agent — deep classification, cross-referencing with memory,
 * reflection/self-correction to catch false positives.
 */
export class AnalysisAgent extends BaseAgent {
  private enableReflection: boolean;

  constructor(
    config: AppConfig,
    toolRegistry: ToolRegistry,
    costTracker?: CostTracker
  ) {
    const options: BaseAgentOptions = {
      role: "analysis",
      apiKey: config.anthropicApiKey,
      model: config.agent.agentModel,
      maxIterations: config.agent.maxAgentIterations,
      systemPrompt: ANALYSIS_SYSTEM_PROMPT,
      toolRegistry,
      costTracker,
    };
    super(options);
    this.enableReflection = config.agent.enableReflection;
  }

  /**
   * Analyze a batch of raw events — classify, cross-reference, reflect.
   */
  async analyze(eventsJson: string): Promise<AgentRunResult> {
    const prompt = this.enableReflection
      ? `Analyze these raw events. Classify each one, cross-reference results, and then use reflect_on_quality to check your work. Record confirmed signals in company memory.\n\nEvents:\n${eventsJson}`
      : `Analyze these raw events. Classify each one and cross-reference results. Record confirmed signals in company memory.\n\nEvents:\n${eventsJson}`;

    return this.run(prompt);
  }

  /**
   * Deep-dive analysis on a specific company's signals.
   */
  async analyzeCompany(
    companyName: string,
    eventsJson: string
  ): Promise<AgentRunResult> {
    return this.run(
      `Deep analysis of signals from "${companyName}". ` +
        `First check company memory for historical context, then classify these events, ` +
        `and assess the company's buying journey progression.\n\nEvents:\n${eventsJson}`
    );
  }
}
