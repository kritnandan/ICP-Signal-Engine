# ICP Buying Signal Monitor — Step-by-Step Guide

A complete walkthrough for setting up, configuring, running, and extending the system.

---

## Table of Contents

1. [What This System Does](#1-what-this-system-does)
2. [Prerequisites](#2-prerequisites)
3. [Installation](#3-installation)
4. [Configuration](#4-configuration)
   - 4.1 [Environment Variables (.env)](#41-environment-variables-env)
   - 4.2 [ICP Profile (config/icp.json)](#42-icp-profile-configicpjson)
5. [Understanding the Architecture](#5-understanding-the-architecture)
6. [Running the System](#6-running-the-system)
   - 6.1 [One-Time Pipeline Run](#61-one-time-pipeline-run)
   - 6.2 [Scheduled Monitoring](#62-scheduled-monitoring)
   - 6.3 [Collectors Only (No Classification)](#63-collectors-only-no-classification)
   - 6.4 [Classify a Single Text Snippet](#64-classify-a-single-text-snippet)
7. [Understanding the Output](#7-understanding-the-output)
   - 7.1 [Output Directory Structure](#71-output-directory-structure)
   - 7.2 [BuyingSignalEvent Schema](#72-buyingsignalevent-schema)
   - 7.3 [Signal Categories Explained](#73-signal-categories-explained)
   - 7.4 [Signal Strength & Buying Stage](#74-signal-strength--buying-stage)
8. [How Each Source Collector Works](#8-how-each-source-collector-works)
   - 8.1 [LinkedIn](#81-linkedin)
   - 8.2 [Twitter / X](#82-twitter--x)
   - 8.3 [Reddit](#83-reddit)
   - 8.4 [GitHub](#84-github)
   - 8.5 [RSS / Blogs / HackerNews](#85-rss--blogs--hackernews)
9. [How the Pipeline Processes Events](#9-how-the-pipeline-processes-events)
   - 9.1 [Step 1 — Collect](#91-step-1--collect)
   - 9.2 [Step 2 — ICP Match](#92-step-2--icp-match)
   - 9.3 [Step 3 — Signal Classification](#93-step-3--signal-classification)
   - 9.4 [Step 4 — Output](#94-step-4--output)
10. [Customizing the ICP Profile](#10-customizing-the-icp-profile)
11. [Integrating with Downstream Systems](#11-integrating-with-downstream-systems)
12. [Running Tests](#12-running-tests)
13. [Troubleshooting](#13-troubleshooting)
14. [Extending the System](#14-extending-the-system)

---

## 1. What This System Does

This system continuously monitors online sources for **procurement, supply chain, and logistics buying signals** from companies that match your Ideal Customer Profile (ICP).

**The pipeline in one sentence:** Collect posts from LinkedIn, Twitter, Reddit, GitHub, and blogs → check if the company fits your ICP → use Claude AI to determine if it's a buying signal → output structured JSON for your CRM, alerting, or sales playbooks.

**Example signals it detects:**

| Source | Content | Detected Signal |
|--------|---------|-----------------|
| LinkedIn | "We're overhauling our global supply chain for resilience in 2026." | `planning_visibility` — strong — research stage |
| Reddit | "Looking for TMS recommendations that integrate with SAP." | `tms_logistics` — strong — evaluation stage |
| Twitter | "Port congestion is killing our OTIF. Need better visibility." | `planning_visibility` — moderate — awareness stage |
| GitHub | "v1.5 – Added WMS/TMS integration via EDI and APIs." | `wms_warehouse` — weak — implementation stage |

---

## 2. Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Node.js** | 18+ | LTS recommended |
| **npm** | 9+ | Comes with Node.js |
| **Anthropic API key** | — | Required for AI-powered signal classification |

**Optional API keys** (enable per-platform collection):

| Platform | Key Type | Where to Get It |
|----------|----------|-----------------|
| LinkedIn | Access Token | [LinkedIn Developer Portal](https://developer.linkedin.com/) |
| Twitter/X | Bearer Token | [Twitter Developer Portal](https://developer.twitter.com/) |
| Reddit | OAuth Client ID + Secret | [Reddit App Preferences](https://www.reddit.com/prefs/apps) |
| GitHub | Personal Access Token | [GitHub Settings > Tokens](https://github.com/settings/tokens) |
| RSS | None | Just provide feed URLs |

> The system gracefully skips any platform that isn't configured. You can start with just RSS feeds and add other sources later.

---

## 3. Installation

```bash
# Clone or navigate to the project directory
cd ICP

# Install dependencies
npm install

# Copy the example environment file
cp .env.example .env

# Verify the installation
npm test
```

Expected output:
```
 ✓ tests/signal-classifier.test.ts (4 tests)
 ✓ tests/icp-matcher.test.ts (6 tests)
 ✓ tests/output-writer.test.ts (4 tests)

 Test Files  3 passed (3)
      Tests  14 passed (14)
```

---

## 4. Configuration

### 4.1 Environment Variables (.env)

Open `.env` and fill in the values you need:

```bash
# ── REQUIRED ──────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-your-key-here

# ── LINKEDIN (optional) ──────────────────────────
LINKEDIN_ACCESS_TOKEN=your-token
LINKEDIN_COMPANY_IDS=microsoft,oracle,sap
LINKEDIN_KEYWORDS=procurement,supply chain,logistics,sourcing,warehouse

# ── TWITTER / X (optional) ───────────────────────
TWITTER_BEARER_TOKEN=your-bearer-token
TWITTER_ACCOUNTS=@company_ops,@vp_supplychain
TWITTER_KEYWORDS=supply chain,procurement,logistics,TMS,WMS,S2P

# ── REDDIT (optional) ────────────────────────────
REDDIT_CLIENT_ID=your-client-id
REDDIT_CLIENT_SECRET=your-secret
REDDIT_USER_AGENT=icp-signal-monitor/1.0
REDDIT_SUBREDDITS=supplychain,logistics,procurement,warehousing

# ── GITHUB (optional) ────────────────────────────
GITHUB_TOKEN=ghp_your-token
GITHUB_REPOS=apache/superset,frappe/erpnext
GITHUB_KEYWORDS=supply chain,logistics,warehouse,procurement

# ── RSS / BLOGS (optional) ───────────────────────
RSS_FEEDS=https://example.com/blog/feed,https://company.com/news/rss

# ── PIPELINE SETTINGS ────────────────────────────
OUTPUT_DIR=./output
LOG_LEVEL=info                        # debug | info | warn | error
CRON_SCHEDULE=0 */4 * * *            # Every 4 hours
SIGNAL_CONFIDENCE_THRESHOLD=0.6       # 0-1, signals below this are filtered out
MAX_EVENTS_PER_RUN=500                # Cap per pipeline run
ICP_CONFIG_PATH=./config/icp.json
```

**Key settings explained:**

| Setting | Default | What It Controls |
|---------|---------|-----------------|
| `SIGNAL_CONFIDENCE_THRESHOLD` | `0.6` | Minimum confidence (0-1) for a signal to appear in output. Lower = more signals but more noise. Higher = fewer but higher-quality signals. |
| `MAX_EVENTS_PER_RUN` | `500` | Caps raw events per run to control API costs. |
| `CRON_SCHEDULE` | `0 */4 * * *` | How often the scheduler runs. Uses standard cron syntax. |
| `LOG_LEVEL` | `info` | Set to `debug` for verbose collector output. |

### 4.2 ICP Profile (config/icp.json)

This file defines your **Ideal Customer Profile** — the criteria used to score whether a detected event is relevant to your business:

```json
{
  "name": "Supply Chain & Procurement ICP",
  "industries": [
    "Manufacturing", "Retail", "Consumer Goods",
    "Pharmaceuticals", "Automotive", "Logistics & Transportation"
  ],
  "minEmployees": 500,
  "maxEmployees": 500000,
  "minRevenue": 100,
  "geographies": ["United States", "Canada", "United Kingdom", "Germany"],
  "techStack": ["SAP", "Oracle", "Coupa", "Ariba", "Blue Yonder", "Kinaxis"],
  "targetRoles": [
    "VP Supply Chain", "VP Procurement", "Director of Logistics",
    "Chief Procurement Officer", "S2P Program Manager"
  ],
  "excludeCompanies": ["CompetitorCo"],
  "customRules": [
    {
      "field": "body",
      "operator": "regex",
      "value": "(RFP|RFQ|RFI|vendor selection|digital transformation)"
    }
  ]
}
```

See [Section 10](#10-customizing-the-icp-profile) for a detailed customization guide.

---

## 5. Understanding the Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLI / Scheduler                          │
│                     (cli.ts / scheduler.ts)                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Pipeline Orchestrator                       │
│                       (pipeline.ts)                              │
│                                                                  │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│   │ Step 1   │───▶│ Step 2   │───▶│ Step 3   │───▶│ Step 4   │ │
│   │ COLLECT  │    │ ICP      │    │ CLASSIFY │    │ OUTPUT   │ │
│   │          │    │ MATCH    │    │          │    │          │ │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘ │
└──────┬───────────────────────────────────────────────────┬──────┘
       │                                                   │
       ▼                                                   ▼
┌──────────────┐                                 ┌────────────────┐
│  Collectors  │                                 │    Output      │
│              │                                 │                │
│ • LinkedIn   │                                 │ • events/*.json│
│ • Twitter    │                                 │ • runs/*.jsonl │
│ • Reddit     │                                 │ • latest.json  │
│ • GitHub     │                                 └────────────────┘
│ • RSS / HN   │
└──────────────┘
```

**Data flow:**

1. **Collectors** pull raw events from each configured platform
2. **ICP Matcher** scores each event against your profile (rule-based, instant)
3. **Signal Classifier** uses Claude AI to determine if it's a buying signal (with rule-based fallback if the API is unavailable)
4. **Output Writer** writes validated JSON to disk

---

## 6. Running the System

### 6.1 One-Time Pipeline Run

Run the full pipeline once — collect, match, classify, and output:

```bash
npm run pipeline
```

Output:
```json
{
  "runId": "run_m5abc_1a2b3c4d5e6f",
  "startedAt": "2026-02-27T10:00:00.000Z",
  "completedAt": "2026-02-27T10:01:23.456Z",
  "totalCollected": 247,
  "totalSignals": 18,
  "totalNoise": 229,
  "outputFile": "./output/runs/run_m5abc_1a2b3c4d5e6f.jsonl",
  "eventsBySource": {
    "reddit": 8,
    "rss": 5,
    "linkedin": 3,
    "twitter": 2
  },
  "eventsByCategory": {
    "procurement_sourcing": 6,
    "tms_logistics": 4,
    "planning_visibility": 3,
    "s2p_transformation": 3,
    "wms_warehouse": 2
  }
}
```

### 6.2 Scheduled Monitoring

Start the cron-based scheduler that runs automatically:

```bash
npm run schedule
```

- Runs immediately on start, then at the configured `CRON_SCHEDULE`
- Prevents overlapping runs (skips if previous run is still in progress)
- Stop with `Ctrl+C` (graceful shutdown)

**Common cron schedules:**

| Schedule | Cron Expression |
|----------|-----------------|
| Every 4 hours | `0 */4 * * *` |
| Every hour | `0 * * * *` |
| Twice daily (8am, 4pm UTC) | `0 8,16 * * *` |
| Every 30 minutes | `*/30 * * * *` |
| Daily at midnight UTC | `0 0 * * *` |

### 6.3 Collectors Only (No Classification)

Run just the collectors to see what raw events come back, without spending API credits on classification:

```bash
npm run collect
```

This is useful for:
- Testing that your API keys work
- Seeing what volume of raw events each source produces
- Debugging a specific platform's data format

### 6.4 Classify a Single Text Snippet

Test the signal classifier on any text:

```bash
npm run classify -- "We're kicking off an RFP for a new source-to-pay platform next quarter."
```

Output:
```json
{
  "isSignal": true,
  "confidence": 0.95,
  "category": "s2p_transformation",
  "strength": "strong",
  "buyingStage": "evaluation",
  "reasoning": "Explicit mention of RFP and source-to-pay platform indicates active vendor evaluation.",
  "keywords": ["RFP", "source-to-pay", "platform"],
  "suggestedActions": [
    "Reach out with S2P case studies and ROI data",
    "Request to be included in the RFP process",
    "Offer a discovery call to understand requirements"
  ]
}
```

You can also specify the source platform:

```bash
npm run classify -- -s linkedin "Our supply chain needs a complete overhaul."
```

---

## 7. Understanding the Output

### 7.1 Output Directory Structure

After a pipeline run, the `output/` directory looks like this:

```
output/
├── events/                          # One JSON file per detected signal
│   ├── li_m5abc_a1b2c3d4e5f6.json
│   ├── rd_m5abc_f6e5d4c3b2a1.json
│   └── tw_m5abc_1f2e3d4c5b6a.json
├── runs/                            # One JSONL file per pipeline run
│   ├── run_m5abc_1a2b3c4d5e6f.jsonl
│   └── run_m5def_7a8b9c0d1e2f.jsonl
├── latest.json                      # Rolling summary of most recent run
└── pipeline.log                     # Application logs
```

| File | Format | Purpose |
|------|--------|---------|
| `events/*.json` | JSON (pretty-printed) | Individual signal events for granular processing |
| `runs/*.jsonl` | JSONL (one JSON object per line) | Batch files for bulk ingestion |
| `latest.json` | JSON | Quick summary with counts and last 50 events |
| `pipeline.log` | Text | Timestamped application logs |

### 7.2 BuyingSignalEvent Schema

Every output event follows this structure:

```json
{
  "eventId": "rd_m5abc_f6e5d4c3b2a1",
  "timestamp": "2026-02-27T10:01:15.000Z",

  "source": {
    "platform": "reddit",
    "contentType": "post",
    "url": "https://reddit.com/r/supplychain/comments/abc123",
    "author": "logistics_pro_42",
    "authorRole": null
  },

  "company": {
    "companyName": "AcmeCorp",
    "matchScore": 0.75,
    "matchedCriteria": [
      "content_relevance_high",
      "tech_stack:SAP,Oracle",
      "custom:body:regex"
    ],
    "unmatchedCriteria": [
      "target_role",
      "industry_signal"
    ]
  },

  "signal": {
    "isSignal": true,
    "confidence": 0.88,
    "category": "tms_logistics",
    "strength": "strong",
    "buyingStage": "research",
    "reasoning": "Active research for TMS recommendations with specific ERP integration requirements.",
    "keywords": ["TMS", "SAP", "3PL", "multi-carrier"],
    "suggestedActions": [
      "Share TMS integration case studies for SAP environments",
      "Offer a demo focused on multi-carrier management"
    ]
  },

  "rawContent": {
    "title": "Looking for TMS recommendations",
    "body": "We need a TMS that integrates with our SAP ERP and supports multiple 3PLs...",
    "publishedAt": "2026-02-27T08:30:00.000Z"
  },

  "pipeline": {
    "collectedAt": "2026-02-27T10:00:45.000Z",
    "processedAt": "2026-02-27T10:01:15.000Z",
    "pipelineVersion": "1.0.0"
  }
}
```

### 7.3 Signal Categories Explained

| Category | Description | Example Trigger |
|----------|-------------|-----------------|
| `planning_visibility` | Demand/supply planning, control towers, visibility platforms | "We need end-to-end supply chain visibility" |
| `inventory_optimization` | Inventory management, safety stock, demand sensing | "Stockouts are costing us millions" |
| `procurement_sourcing` | Strategic sourcing, e-procurement, category management | "Kicking off an RFP for e-sourcing" |
| `tms_logistics` | Transportation management, freight, carrier management | "Looking for a multi-carrier TMS" |
| `wms_warehouse` | Warehouse management, fulfillment, DC operations | "Expanding to 3 new DCs—need WMS" |
| `s2p_transformation` | Source-to-pay, procure-to-pay, AP automation | "Digitizing S2P across 50+ plants" |
| `erp_migration` | ERP system changes, platform migration | "Migrating from SAP ECC to S/4HANA" |
| `supplier_risk` | Supplier risk management, SRM, compliance | "Supplier risk process is spreadsheet-driven" |
| `network_design` | Supply chain network design, DC location strategy | "Redesigning distribution for 2-day delivery" |
| `analytics_reporting` | Supply chain analytics, dashboards, data platforms | "Standardizing on Snowflake for SC analytics" |
| `general_operations` | General ops improvement not fitting above | "Improving operational efficiency" |

### 7.4 Signal Strength & Buying Stage

**Strength** indicates how explicit the buying intent is:

| Strength | Meaning | Examples |
|----------|---------|---------|
| `strong` | Explicit buying/evaluating/implementing language | "RFP", "evaluating vendors", "implementing Coupa" |
| `moderate` | Clear pain point or interest, no active buying language | "We need better visibility", "current setup can't handle volume" |
| `weak` | Relevant discussion but no clear buying intent | "Supply chain trends for 2026" |

**Buying Stage** maps to the buyer's journey:

| Stage | Meaning | Typical Actions |
|-------|---------|-----------------|
| `awareness` | Recognizes a problem | Share thought leadership content |
| `research` | Exploring solutions | Send educational resources, case studies |
| `evaluation` | Comparing vendors, running RFP/RFQ | Request inclusion in evaluation, offer demos |
| `decision` | Selecting a vendor | Provide competitive positioning, references |
| `implementation` | Deploying or rolling out | Offer implementation support, expansion |

---

## 8. How Each Source Collector Works

### 8.1 LinkedIn

**API:** LinkedIn Marketing API (`/v2/ugcPosts`, `/v2/jobSearch`)

**What it monitors:**
- Company page posts for each configured `LINKEDIN_COMPANY_IDS`
- Job listings matching your keywords

**Configuration:**
```bash
LINKEDIN_ACCESS_TOKEN=your-token
LINKEDIN_COMPANY_IDS=microsoft,oracle,sap     # Comma-separated org IDs or vanity names
LINKEDIN_KEYWORDS=procurement,supply chain     # Keywords for job search filtering
```

**What triggers a signal:**
- Company announcing supply chain initiatives
- Executive posts about procurement challenges
- Job listings for S2P Program Manager, Supply Chain Architect, etc.

### 8.2 Twitter / X

**API:** Twitter API v2 (`/tweets/search/recent`)

**What it monitors:**
- Keyword-based search across all public tweets
- Specific account timelines

**Configuration:**
```bash
TWITTER_BEARER_TOKEN=your-bearer-token
TWITTER_ACCOUNTS=@company_ops,@vp_supplychain   # Specific accounts to follow
TWITTER_KEYWORDS=supply chain,TMS,WMS,S2P        # Search keywords (OR logic)
```

**What triggers a signal:**
- Executives complaining about supply chain pain points
- Public questions about tooling recommendations
- Announcements about logistics/procurement changes

### 8.3 Reddit

**API:** Reddit OAuth (`/r/{subreddit}/new`)

**What it monitors:**
- New posts in configured subreddits

**Configuration:**
```bash
REDDIT_CLIENT_ID=your-client-id
REDDIT_CLIENT_SECRET=your-secret
REDDIT_USER_AGENT=icp-signal-monitor/1.0
REDDIT_SUBREDDITS=supplychain,logistics,procurement,warehousing
```

**What triggers a signal:**
- "What WMS do you recommend for mid-market?"
- "Looking for TMS that integrates with Oracle"
- "Anyone migrated from manual PO processes to S2P?"

### 8.4 GitHub

**API:** GitHub REST API (`/repos/{owner}/{repo}/releases`, `/repos/{owner}/{repo}/issues`)

**What it monitors:**
- Releases from configured repos (filtered by keywords)
- Open issues from the last 7 days (filtered by keywords)

**Configuration:**
```bash
GITHUB_TOKEN=ghp_your-token
GITHUB_REPOS=apache/superset,frappe/erpnext       # Repos to watch
GITHUB_KEYWORDS=supply chain,logistics,warehouse    # Filter keywords
```

**What triggers a signal:**
- Release notes mentioning WMS/TMS integration
- Issues discussing supply chain analytics requirements
- Discussions about ERP data connectors

### 8.5 RSS / Blogs / HackerNews

**API:** RSS/Atom parsing + HackerNews Algolia search

**What it monitors:**
- Any RSS/Atom feed you configure (company blogs, industry news)
- HackerNews stories matching supply chain keywords (automatic)

**Configuration:**
```bash
RSS_FEEDS=https://company.com/blog/feed,https://industry-news.com/rss
```

**Built-in HackerNews queries** (no configuration needed):
- "supply chain software"
- "procurement platform"
- "logistics technology"
- "warehouse management system"

**What triggers a signal:**
- Blog posts about distribution network redesign
- Press releases about logistics partnerships
- HN discussions about supply chain tooling

---

## 9. How the Pipeline Processes Events

### 9.1 Step 1 — Collect

All enabled collectors run **in parallel**. Each returns an array of `RawEvent` objects with a common shape:

```
RawEvent {
  id, source, contentType, url, title, body,
  author, authorRole, companyHint, tags,
  collectedAt, publishedAt, metadata
}
```

- Failed collectors don't block others (uses `Promise.allSettled`)
- Events are capped at `MAX_EVENTS_PER_RUN` (default 500)

### 9.2 Step 2 — ICP Match

Each raw event is scored against `config/icp.json`:

| Check | Weight | What it Looks For |
|-------|--------|-------------------|
| **Exclusion** | Instant reject | Company in `excludeCompanies` list |
| **Target Role** | 1 criterion | Author role matches any `targetRoles` |
| **Content Relevance** | 1 criterion | High-signal terms (RFP, vendor selection) and medium-signal terms (supply chain, procurement) |
| **Tech Stack** | 1 criterion | Mentions of platforms in `techStack` |
| **Industry** | 1 criterion | Industry keywords in content |
| **Custom Rules** | 1 criterion each | Regex/contains/equals/gt/lt on any event field |

**Score** = matched criteria / total criteria (0-1). Events with score 0 are filtered out.

### 9.3 Step 3 — Signal Classification

Events that pass ICP matching are sent to **Claude Sonnet** for classification:

- Batched with configurable concurrency (default 5 parallel requests)
- Each event gets a structured JSON response with category, strength, buying stage, and reasoning
- **Fallback:** If the API call fails, a rule-based keyword classifier takes over
- Events with `confidence < SIGNAL_CONFIDENCE_THRESHOLD` are filtered out

### 9.4 Step 4 — Output

Signals that pass all filters are written as `BuyingSignalEvent` objects:

1. **Individual files** → `output/events/{eventId}.json` (pretty-printed)
2. **Batch file** → `output/runs/{runId}.jsonl` (one JSON per line)
3. **Summary** → `output/latest.json` (aggregated counts + last 50 events)

All events are validated against a **Zod schema** before writing. Invalid events are logged and skipped.

---

## 10. Customizing the ICP Profile

Edit `config/icp.json` to match your ideal customer:

### Change target industries

```json
"industries": ["Manufacturing", "Retail", "Healthcare"]
```

### Narrow by company size

```json
"minEmployees": 1000,
"maxEmployees": 50000,
"minRevenue": 500
```

### Add tech stack signals

```json
"techStack": ["SAP S/4HANA", "Coupa", "Jaggaer", "GEP", "Ivalua"]
```

### Define target buyer roles

```json
"targetRoles": [
  "Chief Procurement Officer",
  "VP Supply Chain",
  "Director of Strategic Sourcing"
]
```

### Exclude known non-targets

```json
"excludeCompanies": ["OurCompany", "DirectCompetitor"]
```

### Add custom rules

```json
"customRules": [
  {
    "field": "body",
    "operator": "regex",
    "value": "(RFP|RFQ|vendor selection|platform evaluation)"
  },
  {
    "field": "body",
    "operator": "contains",
    "value": "digital transformation"
  }
]
```

**Available operators:** `contains`, `equals`, `regex`, `gt`, `lt`

---

## 11. Integrating with Downstream Systems

### Read the JSONL batch file

```python
# Python example — read the latest run
import json

with open("output/runs/run_latest_id.jsonl") as f:
    for line in f:
        event = json.loads(line)
        if event["signal"]["strength"] == "strong":
            push_to_crm(event)
```

### Read latest.json for a quick summary

```javascript
// Node.js example
import { readFileSync } from "fs";

const latest = JSON.parse(readFileSync("output/latest.json", "utf-8"));
console.log(`${latest.signalCount} signals detected`);
console.log("By category:", latest.byCategory);
```

### Use as a library

```typescript
import { Pipeline, loadConfig } from "icp-buying-signal-monitor";

const config = loadConfig();
const pipeline = new Pipeline(config);
const result = await pipeline.run();

// result.totalSignals, result.eventsByCategory, etc.
```

### Webhook / API integration pattern

Read `output/events/` for new files and POST them to your CRM or Slack:

```bash
# Watch for new signal files and POST to a webhook
inotifywait -m output/events/ -e create |
  while read dir action file; do
    curl -X POST https://your-webhook.com/signals \
      -H "Content-Type: application/json" \
      -d @"output/events/$file"
  done
```

---

## 12. Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-run on file changes)
npm run test:watch
```

**Test coverage:**

| Test Suite | Tests | What It Validates |
|-----------|-------|-------------------|
| `icp-matcher.test.ts` | 6 | Role matching, tech stack detection, custom rules, content relevance scoring, exclusion logic |
| `signal-classifier.test.ts` | 4 | Event structure, schema validation, confidence bounds |
| `output-writer.test.ts` | 4 | Individual file writing, batch JSONL writing, latest.json summary generation |

---

## 13. Troubleshooting

### "Skipped – no access token configured"

A collector is disabled because its API key isn't set in `.env`. This is normal — the system only runs collectors that are configured.

### Classification returns low confidence for everything

- Check that `ANTHROPIC_API_KEY` is valid
- Try lowering `SIGNAL_CONFIDENCE_THRESHOLD` from `0.6` to `0.4`
- Test with `npm run classify -- "your text"` to see raw classification output

### No signals in output

- Run `npm run collect` first to verify collectors are returning data
- Check `output/pipeline.log` for errors
- Verify your ICP profile isn't too restrictive (temporarily widen criteria)
- Set `LOG_LEVEL=debug` for verbose output

### Rate limiting from APIs

- Reduce `MAX_EVENTS_PER_RUN`
- Increase `CRON_SCHEDULE` interval
- The classifier uses batching with concurrency of 5 by default

### TypeScript build errors

```bash
# Check for type errors without emitting
npx tsc --noEmit

# Build to dist/
npm run build
```

---

## 14. Extending the System

### Add a new collector

1. Create `src/collectors/myplatform.ts`:

```typescript
import { BaseCollector } from "./base.js";
import type { RawEvent } from "../types.js";

export class MyPlatformCollector extends BaseCollector {
  name = "myplatform" as const;

  async collect(): Promise<RawEvent[]> {
    // Fetch data from your source
    // Return normalized RawEvent[] array
  }
}
```

2. Add the platform to `SourcePlatform` type in `src/types.ts`
3. Register it in `src/collectors/index.ts`
4. Add config interface and env vars in `src/config.ts`

### Add a new signal category

1. Add the category to `SignalCategory` type in `src/types.ts`
2. Add it to the Zod schema's `z.enum()` in the same file
3. Update the system prompt in `src/engines/signal-classifier.ts`
4. Add fallback keywords in the `signalTerms` map

### Add a new output destination

1. Create a new writer in `src/output/` (e.g., `webhook-writer.ts`)
2. Call it alongside `OutputWriter` in `src/pipeline/pipeline.ts` Step 4

### Change the classification model

Edit `src/engines/signal-classifier.ts`:

```typescript
// Use a different Claude model
private model = "claude-haiku-4-5-20251001";  // Faster, cheaper
// or
private model = "claude-opus-4-6";            // Most capable
```

---

## Quick Reference

| Command | What It Does |
|---------|--------------|
| `npm run pipeline` | Full run: collect → match → classify → output |
| `npm run schedule` | Start cron scheduler |
| `npm run collect` | Run collectors only |
| `npm run classify -- "text"` | Classify a single snippet |
| `npm test` | Run all tests |
| `npm run build` | TypeScript build |
| `npm run dev` | Run CLI in dev mode |

| File | Purpose |
|------|---------|
| `.env` | API keys and pipeline settings |
| `config/icp.json` | Your Ideal Customer Profile |
| `output/latest.json` | Latest run summary |
| `output/events/*.json` | Individual signal events |
| `output/runs/*.jsonl` | Batch output per run |
| `output/pipeline.log` | Application logs |
