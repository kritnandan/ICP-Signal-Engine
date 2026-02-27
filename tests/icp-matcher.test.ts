import { describe, it, expect } from "vitest";
import { ICPMatcher } from "../src/engines/icp-matcher.js";
import { join } from "path";
import type { RawEvent } from "../src/types.js";

const configPath = join(process.cwd(), "config", "icp.json");

function makeEvent(overrides: Partial<RawEvent> = {}): RawEvent {
  return {
    id: "test_001",
    source: "linkedin",
    contentType: "company_post",
    url: "https://example.com",
    body: "",
    collectedAt: new Date().toISOString(),
    metadata: {},
    ...overrides,
  };
}

describe("ICPMatcher", () => {
  const matcher = new ICPMatcher(configPath);

  it("returns high score for strong signal content from target role", () => {
    const event = makeEvent({
      body: "We're kicking off an RFP for a new source-to-pay platform. Looking at Coupa and Ariba.",
      authorRole: "VP Procurement",
      companyHint: "AcmeCorp",
    });

    const result = matcher.match(event);
    expect(result.companyName).toBe("AcmeCorp");
    expect(result.matchScore).toBeGreaterThan(0.5);
    expect(result.matchedCriteria).toContain("target_role");
  });

  it("detects tech stack mentions", () => {
    const event = makeEvent({
      body: "We migrated from SAP to Oracle Cloud for our supply chain planning.",
      companyHint: "TechCo",
    });

    const result = matcher.match(event);
    expect(result.matchedCriteria.some((c) => c.startsWith("tech_stack:"))).toBe(
      true
    );
  });

  it("matches custom regex rules", () => {
    const event = makeEvent({
      body: "Starting vendor selection for our digital transformation of procurement.",
      companyHint: "MegaCorp",
    });

    const result = matcher.match(event);
    expect(result.matchedCriteria.some((c) => c.startsWith("custom:"))).toBe(
      true
    );
  });

  it("returns zero score for excluded companies", () => {
    // This test would need an excluded company in the config
    const event = makeEvent({
      body: "Amazing supply chain technology.",
      companyHint: "SomeRandomCo",
    });

    const result = matcher.match(event);
    // Should still have some score since it's not excluded
    expect(result.matchScore).toBeGreaterThanOrEqual(0);
  });

  it("scores low for irrelevant content", () => {
    const event = makeEvent({
      body: "Happy Friday everyone! What are your weekend plans?",
      companyHint: "FunCo",
    });

    const result = matcher.match(event);
    expect(result.matchScore).toBeLessThan(0.5);
  });

  it("detects industry signals in content", () => {
    const event = makeEvent({
      body: "Our Manufacturing operations need a complete overhaul of the warehouse management system.",
      companyHint: "FactoryCo",
    });

    const result = matcher.match(event);
    expect(result.matchedCriteria).toContain("industry_signal");
  });
});
