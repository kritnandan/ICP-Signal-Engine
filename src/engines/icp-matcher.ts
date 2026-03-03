import { readFileSync } from "fs";
import type {
  RawEvent,
  CompanyMatch,
} from "../types.js";
import { logger } from "../utils/logger.js";

type ICPJson = Record<string, unknown>;

/**
 * ICP Matching Engine.
 *
 * Supports both the new nested ICP schema (v2) and the old flat schema (v1).
 * Scoring is role-weighted, content-intent-based, and normalised to 0-1.
 */
export class ICPMatcher {
  private name: string;
  private industries: string[];
  private decisionMakers: string[];
  private influencers: string[];
  private highIntentTerms: string[];
  private mediumIntentTerms: string[];
  private excludeCompanies: string[];
  private roleScoring: Record<string, number>;
  private weights: { roleScore: number; intentScore: number; companyFitScore: number };

  constructor(configPath: string) {
    const raw = readFileSync(configPath, "utf-8");
    const icp = JSON.parse(raw) as ICPJson;
    this.name = String(icp.name || "ICP");

    // Support both nested (v2) and flat (v1) schemas
    const companyCriteria = icp.companyCriteria as ICPJson | undefined;
    const roleClass = icp.roleClassification as ICPJson | undefined;
    const intentSignals = icp.intentSignals as ICPJson | undefined;
    const scoringModel = icp.scoringModel as ICPJson | undefined;
    const roleScoringRaw = icp.roleScoring as Record<string, number> | undefined;

    // Industries
    this.industries = (companyCriteria?.industries as string[] | undefined)
      ?? (icp.industries as string[] | undefined)
      ?? [];

    // Roles: new schema has decisionMakers + influencers; old schema has targetRoles
    this.decisionMakers = (roleClass?.decisionMakers as string[] | undefined)
      ?? (icp.targetRoles as string[] | undefined)
      ?? [];
    this.influencers = (roleClass?.influencers as string[] | undefined) ?? [];

    // Intent signals
    const intentHigh = (intentSignals?.highIntent as string[] | undefined) ?? [];
    const intentMedium = (intentSignals?.mediumIntent as string[] | undefined) ?? [];
    this.highIntentTerms = intentHigh.length > 0 ? intentHigh : [
      "rfp", "rfq", "rfi", "vendor selection", "platform evaluation",
      "system implementation", "erp migration", "wms implementation",
      "tms implementation", "looking for a solution", "selecting a new vendor"
    ];
    this.mediumIntentTerms = intentMedium.length > 0 ? intentMedium : [
      "digital transformation", "modernization", "process improvement",
      "supply chain upgrade", "re-platform", "automation initiative",
      "supply chain", "procurement", "logistics", "warehouse", "sourcing"
    ];

    // Role scoring weights
    this.roleScoring = roleScoringRaw ?? {
      "C-Level": 10, "VP": 9, "Director": 8, "Head": 8,
      "Senior Manager": 8, "Manager": 7, "Other": 5
    };

    // Scoring model weights
    const weightsRaw = (scoringModel?.weights as Record<string, number> | undefined) ?? {};
    this.weights = {
      roleScore: weightsRaw.roleScore ?? 0.4,
      intentScore: weightsRaw.intentScore ?? 0.4,
      companyFitScore: weightsRaw.companyFitScore ?? 0.2,
    };

    this.excludeCompanies = (icp.excludeCompanies as string[] | undefined) ?? [];

    logger.info(`ICP criteria loaded: "${this.name}" with ${this.industries.length} industries`);
  }

  match(event: RawEvent): CompanyMatch {
    const companyName = event.companyHint ?? "Unknown";
    const matched: string[] = [];
    const unmatched: string[] = [];

    // ── Exclusion check ──
    if (this.excludeCompanies.some(
      (c: string) => c.toLowerCase() === companyName.toLowerCase()
    )) {
      return { companyName, matchScore: 0, matchedCriteria: [], unmatchedCriteria: ["excluded_company"] };
    }

    // ── 1. Role Score (normalised 0-1) ──
    const role = (event.authorRole ?? event.author ?? "").toLowerCase();
    let roleScore = 0;
    if (role) {
      if (this.decisionMakers.some((r: string) => role.includes(r.toLowerCase()))) {
        for (const [tier, weight] of Object.entries(this.roleScoring)) {
          if (role.includes(tier.toLowerCase())) {
            roleScore = Math.max(roleScore, weight / 10);
          }
        }
        roleScore = roleScore || 0.8;
        matched.push("decision_maker_role");
      } else if (this.influencers.some((r: string) => role.includes(r.toLowerCase()))) {
        roleScore = 0.7;
        matched.push("influencer_role");
      } else {
        unmatched.push("target_role");
      }
    } else {
      roleScore = 0.5; // unknown author - neutral
    }

    // ── 2. Intent Score ──
    const text = `${event.title ?? ""} ${event.body}`.toLowerCase();
    let intentScore = 0;
    for (const term of this.highIntentTerms) {
      if (text.includes(term.toLowerCase())) {
        intentScore += 0.15;
        matched.push(`high_intent:${term}`);
      }
    }
    for (const term of this.mediumIntentTerms) {
      if (text.includes(term.toLowerCase())) {
        intentScore += 0.05;
      }
    }
    intentScore = Math.min(intentScore, 1);
    if (intentScore >= 0.5) matched.push("content_relevance_high");
    else if (intentScore >= 0.25) matched.push("content_relevance_medium");
    else unmatched.push("content_relevance");

    // ── 3. Company Fit Score ──
    let companyFitScore = 0;
    const industryMatch = this.industries.some((ind: string) => text.includes(ind.toLowerCase()));
    if (industryMatch) { companyFitScore += 0.5; matched.push("industry_signal"); }
    else unmatched.push("industry_signal");
    companyFitScore += 0.5; // geography is hard to detect from content

    // ── Composite weighted score ──
    const compositeScore =
      roleScore * this.weights.roleScore +
      intentScore * this.weights.intentScore +
      companyFitScore * this.weights.companyFitScore;

    return {
      companyName,
      matchScore: Math.round(compositeScore * 100) / 100,
      matchedCriteria: matched,
      unmatchedCriteria: unmatched,
    };
  }
}
