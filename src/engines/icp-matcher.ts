import { readFileSync } from "fs";
import type {
  ICPCriteria,
  ICPCustomRule,
  RawEvent,
  CompanyMatch,
} from "../types.js";
import { logger } from "../utils/logger.js";

/**
 * ICP Matching Engine.
 *
 * Takes a raw event and checks whether the associated company / content
 * fits the Ideal Customer Profile. Scoring is rule-based: each matched
 * criterion adds weight, and the final score is normalised to 0-1.
 */
export class ICPMatcher {
  private criteria: ICPCriteria;

  constructor(configPath: string) {
    const raw = readFileSync(configPath, "utf-8");
    this.criteria = JSON.parse(raw) as ICPCriteria;
    logger.info(
      `ICP criteria loaded: "${this.criteria.name}" with ${this.criteria.industries.length} industries`
    );
  }

  match(event: RawEvent): CompanyMatch {
    const companyName = event.companyHint ?? "Unknown";
    const matched: string[] = [];
    const unmatched: string[] = [];

    // ── Exclusion check ──
    if (
      this.criteria.excludeCompanies?.some(
        (c) => c.toLowerCase() === companyName.toLowerCase()
      )
    ) {
      return {
        companyName,
        matchScore: 0,
        matchedCriteria: [],
        unmatchedCriteria: ["excluded_company"],
      };
    }

    // ── Role matching ──
    if (this.criteria.targetRoles && this.criteria.targetRoles.length > 0) {
      const role = (event.authorRole ?? event.author ?? "").toLowerCase();
      const roleMatch = this.criteria.targetRoles.some((r) =>
        role.includes(r.toLowerCase())
      );
      if (roleMatch) matched.push("target_role");
      else unmatched.push("target_role");
    }

    // ── Keyword / content relevance ──
    const contentRelevance = this.scoreContentRelevance(event);
    if (contentRelevance >= 0.5) matched.push("content_relevance_high");
    else if (contentRelevance >= 0.25) matched.push("content_relevance_medium");
    else unmatched.push("content_relevance");

    // ── Tech stack mentions ──
    if (this.criteria.techStack && this.criteria.techStack.length > 0) {
      const text = `${event.title ?? ""} ${event.body}`.toLowerCase();
      const techMatches = this.criteria.techStack.filter((t) =>
        text.includes(t.toLowerCase())
      );
      if (techMatches.length > 0) {
        matched.push(`tech_stack:${techMatches.join(",")}`);
      } else {
        unmatched.push("tech_stack");
      }
    }

    // ── Industry signals (heuristic from content) ──
    if (this.criteria.industries.length > 0) {
      const text = `${event.title ?? ""} ${event.body}`.toLowerCase();
      const industryMatch = this.criteria.industries.some((ind) =>
        text.includes(ind.toLowerCase())
      );
      if (industryMatch) matched.push("industry_signal");
      else unmatched.push("industry_signal");
    }

    // ── Custom rules ──
    for (const rule of this.criteria.customRules ?? []) {
      const ruleResult = this.evaluateCustomRule(rule, event);
      if (ruleResult) matched.push(`custom:${rule.field}:${rule.operator}`);
      else unmatched.push(`custom:${rule.field}:${rule.operator}`);
    }

    // ── Score calculation ──
    const total = matched.length + unmatched.length;
    const score = total > 0 ? matched.length / total : 0;

    return {
      companyName,
      matchScore: Math.round(score * 100) / 100,
      matchedCriteria: matched,
      unmatchedCriteria: unmatched,
    };
  }

  private scoreContentRelevance(event: RawEvent): number {
    const text = `${event.title ?? ""} ${event.body}`.toLowerCase();

    const highSignalTerms = [
      "rfp",
      "rfq",
      "rfi",
      "vendor selection",
      "platform evaluation",
      "system implementation",
      "digital transformation",
      "re-platform",
      "overhaul",
      "modernize",
      "modernise",
      "looking for solutions",
      "open to solutions",
      "kicking off",
      "new system",
      "replacing",
    ];

    const mediumSignalTerms = [
      "supply chain",
      "procurement",
      "logistics",
      "warehouse",
      "inventory",
      "sourcing",
      "supplier",
      "demand planning",
      "transportation",
      "distribution",
      "fulfillment",
      "tms",
      "wms",
      "s2p",
      "source-to-pay",
      "erp",
      "control tower",
    ];

    let score = 0;
    for (const term of highSignalTerms) {
      if (text.includes(term)) score += 0.15;
    }
    for (const term of mediumSignalTerms) {
      if (text.includes(term)) score += 0.05;
    }

    return Math.min(score, 1);
  }

  private evaluateCustomRule(
    rule: ICPCustomRule,
    event: RawEvent
  ): boolean {
    const fieldValue = String(
      (event as unknown as Record<string, unknown>)[rule.field] ?? ""
    );

    switch (rule.operator) {
      case "contains":
        return fieldValue
          .toLowerCase()
          .includes(String(rule.value).toLowerCase());
      case "equals":
        return fieldValue.toLowerCase() === String(rule.value).toLowerCase();
      case "regex":
        try {
          return new RegExp(String(rule.value), "i").test(fieldValue);
        } catch {
          return false;
        }
      case "gt":
        return parseFloat(fieldValue) > Number(rule.value);
      case "lt":
        return parseFloat(fieldValue) < Number(rule.value);
      default:
        return false;
    }
  }
}
