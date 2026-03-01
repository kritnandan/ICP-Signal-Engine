import Anthropic from "@anthropic-ai/sdk";
import type { BuyingSignalEvent, CompanyKnowledge } from "../types.js";
import { logger } from "../utils/logger.js";

/**
 * Claude-powered natural language summary generation for signal batches
 * and company profiles.
 */
export class SummaryGenerator {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = "claude-sonnet-4-6") {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  /**
   * Generate a natural language summary of a batch of signals.
   */
  async summarizeSignals(
    events: BuyingSignalEvent[]
  ): Promise<string> {
    if (events.length === 0) {
      return "No signals to summarize.";
    }

    const signalData = events.map((e) => ({
      company: e.company.companyName,
      category: e.signal.category,
      strength: e.signal.strength,
      confidence: e.signal.confidence,
      buyingStage: e.signal.buyingStage,
      source: e.source.platform,
      reasoning: e.signal.reasoning,
    }));

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system:
          "You are a concise B2B sales intelligence analyst. Summarize buying signals in clear, actionable language for a sales team. Focus on: key companies showing buying intent, strongest signals, recommended actions. Use bullet points.",
        messages: [
          {
            role: "user",
            content: `Summarize these ${events.length} buying signals:\n${JSON.stringify(signalData, null, 2)}`,
          },
        ],
      });

      const text =
        response.content[0].type === "text"
          ? response.content[0].text
          : "";
      return text;
    } catch (err) {
      logger.error(
        `Summary generation failed: ${err instanceof Error ? err.message : err}`
      );
      return this.fallbackSummary(events);
    }
  }

  /**
   * Generate a natural language company profile summary.
   */
  async summarizeCompany(
    company: CompanyKnowledge,
    recentSignals: BuyingSignalEvent[]
  ): Promise<string> {
    const companyData = {
      name: company.companyName,
      totalSignals: company.signalCount,
      categories: company.categories,
      buyingStage: company.latestBuyingStage,
      firstSeen: company.firstSeenAt,
      lastSeen: company.lastSeenAt,
      notes: company.notes,
      recentSignals: recentSignals.slice(0, 5).map((e) => ({
        category: e.signal.category,
        strength: e.signal.strength,
        source: e.source.platform,
        reasoning: e.signal.reasoning,
      })),
    };

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 512,
        system:
          "You are a B2B account intelligence analyst. Create a brief company profile based on accumulated buying signals. Include: current buying stage assessment, primary areas of interest, recommended engagement strategy.",
        messages: [
          {
            role: "user",
            content: `Company profile for:\n${JSON.stringify(companyData, null, 2)}`,
          },
        ],
      });

      const text =
        response.content[0].type === "text"
          ? response.content[0].text
          : "";
      return text;
    } catch (err) {
      logger.error(
        `Company summary failed: ${err instanceof Error ? err.message : err}`
      );
      return `${company.companyName}: ${company.signalCount} signals, stage: ${company.latestBuyingStage ?? "unknown"}`;
    }
  }

  private fallbackSummary(events: BuyingSignalEvent[]): string {
    const strong = events.filter(
      (e) => e.signal.strength === "strong"
    );
    const companies = [
      ...new Set(events.map((e) => e.company.companyName)),
    ];

    const lines = [
      `Signal Summary: ${events.length} total signals from ${companies.length} companies.`,
    ];

    if (strong.length > 0) {
      lines.push(
        `Strong signals (${strong.length}): ${strong.map((e) => `${e.company.companyName} [${e.signal.category}]`).join(", ")}`
      );
    }

    return lines.join("\n");
  }
}
