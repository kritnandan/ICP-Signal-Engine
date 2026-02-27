import Anthropic from "@anthropic-ai/sdk";
import type {
  RawEvent,
  SignalClassification,
  SignalCategory,
  SignalStrength,
  BuyingStage,
} from "../types.js";
import { logger } from "../utils/logger.js";

const SYSTEM_PROMPT = `You are a B2B buying-signal analyst specializing in procurement, supply chain, and logistics technology.

Given a piece of online content (post, tweet, job listing, release note, etc.), determine:
1. Whether it represents a genuine buying signal for supply-chain / procurement / logistics solutions
2. The category of signal
3. Signal strength and buying stage
4. Key reasoning and suggested follow-up actions

Respond ONLY with valid JSON matching this schema:
{
  "isSignal": boolean,
  "confidence": number (0-1),
  "category": "planning_visibility" | "inventory_optimization" | "procurement_sourcing" | "tms_logistics" | "wms_warehouse" | "s2p_transformation" | "erp_migration" | "supplier_risk" | "network_design" | "analytics_reporting" | "general_operations",
  "strength": "strong" | "moderate" | "weak",
  "buyingStage": "awareness" | "research" | "evaluation" | "decision" | "implementation",
  "reasoning": "1-2 sentence explanation",
  "keywords": ["list", "of", "relevant", "keywords"],
  "suggestedActions": ["actionable next steps for sales/marketing team"]
}

Category definitions:
- planning_visibility: demand planning, supply planning, control towers, visibility platforms
- inventory_optimization: inventory management, safety stock, demand sensing, replenishment
- procurement_sourcing: sourcing, e-procurement, category management, strategic sourcing
- tms_logistics: transportation management, freight, carrier management, route optimization
- wms_warehouse: warehouse management, fulfillment, pick/pack/ship, DC operations
- s2p_transformation: source-to-pay, procure-to-pay, AP automation, contract management
- erp_migration: ERP changes, system migration, core platform changes
- supplier_risk: supplier risk management, SRM, supplier qualification, compliance
- network_design: supply chain network design, DC location, distribution strategy
- analytics_reporting: supply chain analytics, reporting, dashboards, data platforms
- general_operations: general ops improvement that doesn't fit above categories

Signal strength:
- strong: explicit mention of buying, evaluating, implementing, or RFP/RFQ
- moderate: clear pain point or interest in solutions, but no active buying language
- weak: general discussion relevant to domain but no clear buying intent

Buying stage:
- awareness: recognizing a problem exists
- research: actively looking into solutions or approaches
- evaluation: comparing vendors or running RFP/RFQ
- decision: selecting a vendor or finalizing a deal
- implementation: deploying or rolling out a solution`;

/**
 * Signal Classifier powered by Claude.
 *
 * Sends each raw event to the Anthropic API for classification.
 * Includes batching support to manage API rate limits.
 */
export class SignalClassifier {
  private client: Anthropic;
  private model = "claude-sonnet-4-6";

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async classify(event: RawEvent): Promise<SignalClassification> {
    const userMessage = this.buildPrompt(event);

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";

      return this.parseResponse(text);
    } catch (err) {
      logger.error(
        `Signal classification failed for ${event.id}: ${err instanceof Error ? err.message : err}`
      );
      return this.fallbackClassification(event);
    }
  }

  async classifyBatch(
    events: RawEvent[],
    concurrency = 5
  ): Promise<Map<string, SignalClassification>> {
    const results = new Map<string, SignalClassification>();
    const chunks = this.chunk(events, concurrency);

    for (const batch of chunks) {
      const promises = batch.map(async (event) => {
        const classification = await this.classify(event);
        results.set(event.id, classification);
      });
      await Promise.all(promises);
    }

    return results;
  }

  private buildPrompt(event: RawEvent): string {
    const parts = [
      `Source: ${event.source} (${event.contentType})`,
      event.author ? `Author: ${event.author}` : null,
      event.authorRole ? `Author Role: ${event.authorRole}` : null,
      event.companyHint ? `Company: ${event.companyHint}` : null,
      event.title ? `Title: ${event.title}` : null,
      `Content:\n${event.body}`,
    ];
    return parts.filter(Boolean).join("\n");
  }

  private parseResponse(text: string): SignalClassification {
    // Extract JSON from potential markdown code blocks
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      isSignal: Boolean(parsed.isSignal),
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
      category: this.validateCategory(parsed.category),
      strength: this.validateStrength(parsed.strength),
      buyingStage: this.validateBuyingStage(parsed.buyingStage),
      reasoning: String(parsed.reasoning || ""),
      keywords: Array.isArray(parsed.keywords)
        ? parsed.keywords.map(String)
        : [],
      suggestedActions: Array.isArray(parsed.suggestedActions)
        ? parsed.suggestedActions.map(String)
        : [],
    };
  }

  /**
   * Rule-based fallback when the API call fails.
   */
  private fallbackClassification(event: RawEvent): SignalClassification {
    const text = `${event.title ?? ""} ${event.body}`.toLowerCase();

    const signalTerms: Record<SignalCategory, string[]> = {
      planning_visibility: [
        "demand planning",
        "supply planning",
        "control tower",
        "visibility",
        "s&op",
      ],
      inventory_optimization: [
        "inventory",
        "stockout",
        "safety stock",
        "replenishment",
        "demand sensing",
      ],
      procurement_sourcing: [
        "sourcing",
        "e-sourcing",
        "procurement",
        "category management",
        "spend management",
      ],
      tms_logistics: [
        "tms",
        "transportation management",
        "freight",
        "carrier",
        "route optimization",
        "multi-carrier",
      ],
      wms_warehouse: [
        "wms",
        "warehouse management",
        "fulfillment",
        "pick and pack",
        "dc operations",
      ],
      s2p_transformation: [
        "s2p",
        "source-to-pay",
        "procure-to-pay",
        "p2p",
        "contract management",
        "ap automation",
      ],
      erp_migration: [
        "erp",
        "sap migration",
        "oracle cloud",
        "system migration",
        "re-platform",
      ],
      supplier_risk: [
        "supplier risk",
        "srm",
        "supplier qualification",
        "supplier compliance",
        "vendor risk",
      ],
      network_design: [
        "network design",
        "distribution network",
        "dc location",
        "supply chain network",
      ],
      analytics_reporting: [
        "analytics",
        "dashboard",
        "reporting",
        "data platform",
        "snowflake",
        "databricks",
      ],
      general_operations: [
        "operations",
        "efficiency",
        "optimization",
        "process improvement",
      ],
    };

    let bestCategory: SignalCategory = "general_operations";
    let bestScore = 0;
    const keywords: string[] = [];

    for (const [category, terms] of Object.entries(signalTerms)) {
      let score = 0;
      for (const term of terms) {
        if (text.includes(term)) {
          score++;
          keywords.push(term);
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category as SignalCategory;
      }
    }

    const isSignal = bestScore >= 1;
    const confidence = Math.min(bestScore * 0.2, 0.8);

    return {
      isSignal,
      confidence,
      category: bestCategory,
      strength: bestScore >= 3 ? "strong" : bestScore >= 2 ? "moderate" : "weak",
      buyingStage: this.inferBuyingStage(text),
      reasoning: `Fallback classification: matched ${bestScore} keyword(s) in ${bestCategory}`,
      keywords,
      suggestedActions: isSignal
        ? ["Review content manually", "Research company further"]
        : [],
    };
  }

  private inferBuyingStage(text: string): BuyingStage {
    if (/rfp|rfq|rfi|vendor selection|shortlist|evaluating vendors/i.test(text))
      return "evaluation";
    if (/implementing|rolling out|go-live|deployment|migrating to/i.test(text))
      return "implementation";
    if (/selected|chose|signed|contracted with|partnered with/i.test(text))
      return "decision";
    if (/looking for|recommend|anyone using|what .* do you use/i.test(text))
      return "research";
    return "awareness";
  }

  private validateCategory(val: unknown): SignalCategory {
    const valid: SignalCategory[] = [
      "planning_visibility",
      "inventory_optimization",
      "procurement_sourcing",
      "tms_logistics",
      "wms_warehouse",
      "s2p_transformation",
      "erp_migration",
      "supplier_risk",
      "network_design",
      "analytics_reporting",
      "general_operations",
    ];
    return valid.includes(val as SignalCategory)
      ? (val as SignalCategory)
      : "general_operations";
  }

  private validateStrength(val: unknown): SignalStrength {
    const valid: SignalStrength[] = ["strong", "moderate", "weak"];
    return valid.includes(val as SignalStrength)
      ? (val as SignalStrength)
      : "weak";
  }

  private validateBuyingStage(val: unknown): BuyingStage {
    const valid: BuyingStage[] = [
      "awareness",
      "research",
      "evaluation",
      "decision",
      "implementation",
    ];
    return valid.includes(val as BuyingStage)
      ? (val as BuyingStage)
      : "awareness";
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  }
}
