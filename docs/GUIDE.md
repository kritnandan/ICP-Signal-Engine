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
   - 4.3 [Agent Mode Configuration](#43-agent-mode-configuration)
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
10. [Agentic AI Mode](#10-agentic-ai-mode)
    - 10.1 [Overview — What Changed](#101-overview--what-changed)
    - 10.2 [Interactive Chat Mode](#102-interactive-chat-mode)
    - 10.3 [One-Shot Ask Mode](#103-one-shot-ask-mode)
    - 10.4 [Slash Commands](#104-slash-commands)
    - 10.5 [How the Agents Work](#105-how-the-agents-work)
    - 10.6 [Persistent Memory System](#106-persistent-memory-system)
    - 10.7 [Human-in-the-Loop Feedback](#107-human-in-the-loop-feedback)
    - 10.8 [Reflection & Self-Correction](#108-reflection--self-correction)
    - 10.9 [Agent-Mode Scheduling](#109-agent-mode-scheduling)
11. [Guided Setup Wizard](#11-guided-setup-wizard)
12. [Customizing the ICP Profile](#12-customizing-the-icp-profile)
13. [Integrating with Downstream Systems](#13-integrating-with-downstream-systems)
14. [Running Tests](#14-running-tests)
15. [Troubleshooting](#15-troubleshooting)
16. [Extending the System](#16-extending-the-system)

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
 ✓ tests/conversation/message-formatter.test.ts (9 tests)
 ✓ tests/signal-classifier.test.ts (4 tests)
 ✓ tests/tools/tool-registry.test.ts (7 tests)
 ✓ tests/icp-matcher.test.ts (6 tests)
 ✓ tests/output-writer.test.ts (4 tests)
 ✓ tests/memory/memory-store.test.ts (8 tests)
 ✓ tests/tools/collector-tools.test.ts (5 tests)
 ✓ tests/agents/base-agent.test.ts (4 tests)
 ✓ tests/memory/company-memory.test.ts (8 tests)
 ✓ tests/agents/orchestrator.test.ts (6 tests)

 Test Files  10 passed (10)
      Tests  61 passed (61)
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

See [Section 12](#12-customizing-the-icp-profile) for a detailed customization guide.

### 4.3 Agent Mode Configuration

These environment variables control the agentic AI system. All have sensible defaults — you only need to set `AGENT_MODE=true` to enable it:

```bash
# ── AGENT MODE ──────────────────────────────────
AGENT_MODE=true                       # Enable agentic AI mode (default: false)
AGENT_MODEL=claude-sonnet-4-6         # Model for agent reasoning (default: claude-sonnet-4-6)
MAX_AGENT_ITERATIONS=15               # Max ReAct loop iterations per agent call (default: 15)
ENABLE_REFLECTION=true                # Enable reflection/self-correction pass (default: true)
ENABLE_MEMORY=true                    # Enable persistent memory system (default: true)
MEMORY_DIR=./data/memory              # Directory for persistent JSON stores (default: ./data/memory)
```

| Setting | Default | What It Controls |
|---------|---------|-----------------|
| `AGENT_MODE` | `false` | Enables agent-mode scheduling and unlocks `chat`/`ask` commands |
| `AGENT_MODEL` | `claude-sonnet-4-6` | Which Claude model agents use for reasoning and tool selection |
| `MAX_AGENT_ITERATIONS` | `15` | Safety limit on ReAct loop iterations to prevent runaway API costs |
| `ENABLE_REFLECTION` | `true` | Whether the Analysis Agent runs a self-correction pass on results |
| `ENABLE_MEMORY` | `true` | Whether signals are persisted in the memory system across runs |
| `MEMORY_DIR` | `./data/memory` | Where company knowledge, signal history, and preferences are stored |

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

## 10. Agentic AI Mode

### 10.1 Overview — What Changed

The system now has two modes:

| Mode | Commands | How It Works |
|------|----------|-------------|
| **Legacy Pipeline** | `pipeline`, `collect`, `classify`, `schedule` | Fixed scripted flow: collect → match → classify → output. No AI decisions. |
| **Agentic AI** | `chat`, `ask`, `setup` | Multi-agent system with autonomous reasoning, tool use, persistent memory, and natural language interface. |

**Architecture comparison:**

```
LEGACY (scripted pipeline):
  Collect → Match → Classify → Output   (fixed, no AI decisions)

AGENTIC (multi-agent system):
  User (natural language)
    → Orchestrator Agent (plans, delegates, replans)
      → Research Agent (chooses sources, adapts queries)
      → Analysis Agent (classifies, cross-references, self-critiques)
      → Memory Agent (persistent knowledge, deduplication, feedback)
    → Enriched Output (JSON + natural language summaries)
```

All existing commands still work exactly as before. The agentic system is additive.

### 10.2 Interactive Chat Mode

Start a conversational session with the AI:

```bash
npm run chat
```

This opens an interactive REPL where you can ask questions in natural language:

```
  ICP Buying Signal Monitor — Agentic Mode
  Powered by Claude AI

  Ask me anything about buying signals in procurement,
  supply chain, and logistics. Examples:

  > "Find TMS signals from manufacturing companies"
  > "What do we know about Acme Corp?"
  > "Show me strong signals from the last week"
  > "Analyze buying signals on Reddit"

  Commands: /help /status /companies /history /export /quit

> Find strong procurement signals from the last week

  Thinking...

  ## Signal Analysis Summary

  Found **7 buying signals** from **4 companies**.

  ### Strong Signals (3)
  - **MegaCorp** [procurement_sourcing] — Active RFP for source-to-pay platform
  - **GlobalMfg** [s2p_transformation] — Evaluating Coupa vs Ariba
  - **TechRetail** [procurement_sourcing] — VP Procurement posted about vendor selection

  [orchestrator | 8 steps | 2,450 tokens | 4.2s]
```

The Orchestrator Agent autonomously decides which sources to search, how to classify results, and how to present findings. It maintains conversation context across messages — you can ask follow-up questions.

### 10.3 One-Shot Ask Mode

For quick, non-interactive queries:

```bash
npm run ask -- "Show me strong signals from manufacturing"
```

This runs a single query through the orchestrator and exits. Useful for scripts, cron jobs, or quick lookups.

### 10.4 Slash Commands

Inside the chat REPL, these slash commands are available:

| Command | What It Does |
|---------|-------------|
| `/help` | Show all available commands |
| `/status` | Show system status: API calls, token usage, tracked companies, signal count |
| `/companies` | List all tracked companies with signal counts and buying stages |
| `/history` | Show recent signal history across all sources |
| `/feedback <eventId> <relevant\|irrelevant>` | Record feedback on a signal to improve future analysis |
| `/export` | Export the current conversation to a JSON file |
| `/clear` | Clear conversation context (start fresh) |
| `/quit` | Exit the REPL |

**Example: Providing feedback**
```
> /feedback evt_m5abc_1a2b3c relevant Great signal, we're already in talks with them.

  Feedback recorded: evt_m5abc_1a2b3c = relevant
```

### 10.5 How the Agents Work

The system uses four specialized agents, each with a distinct role:

#### Orchestrator Agent
- **Role:** Central brain. Receives user requests, plans which tools/agents to use, delegates work, synthesizes results.
- **Tools:** All collector, analysis, output, and memory tools + delegation to sub-agents.
- **When it delegates:** Complex multi-step tasks (e.g., "Find and analyze all signals from last week") get delegated. Simple lookups are handled directly.

#### Research Agent
- **Role:** Data collection specialist. Chooses the most relevant sources, crafts effective search queries, adapts strategy based on initial results.
- **Tools:** All collector tools (search_linkedin, search_twitter, search_reddit, search_github, search_rss, search_hackernews).
- **Strategy:** For company searches → LinkedIn + Twitter first. For category searches → Reddit + HN + RSS. Broadens queries if initial results are thin.

#### Analysis Agent
- **Role:** Deep classification and cross-referencing. Runs ICP matching, signal classification, cross-references signals across sources, and performs reflection.
- **Tools:** match_icp_profile, classify_signal, classify_batch, cross_reference_signals, reflect_on_quality, plus memory tools.
- **Two-pass analysis:** Classify first, then run `reflect_on_quality` to catch false positives and adjust confidence scores.

#### Memory Agent
- **Role:** Persistent knowledge management. Answers "what do we know about X?", tracks trends, manages user preferences and feedback.
- **Tools:** read_company_memory, write_company_memory, query_signal_history, read_user_preferences, update_user_preferences, record_feedback.

**ReAct Loop:** Each agent uses the Anthropic tool-use API in a loop:

```
User message → Model responds with thought + tool_use →
Execute tool → Return tool_result → Model responds with thought + tool_use →
... → Model responds with final text (no more tools) → Done
```

This allows agents to reason about what to do, take actions, observe results, and adapt — rather than following a fixed script.

### 10.6 Persistent Memory System

The memory system stores knowledge in `data/memory/` as JSON files that persist across runs:

| File | What It Stores |
|------|---------------|
| `companies.json` | Accumulated knowledge per company: signal count, categories, buying stage progression, notes, aliases |
| `signals.json` | Signal history with deduplication hashes. Used for trend detection and avoiding re-processing. |
| `preferences.json` | User preferences learned from interactions: focus industries, companies, confidence thresholds, output format |
| `feedback.json` | User feedback on signals (relevant/irrelevant/partially_relevant) for calibration |

**Company knowledge accumulates over time:**

```
Run 1: Detect "AcmeCorp" posting about TMS evaluation → Create company record
Run 2: Detect "AcmeCorp" RFP on Reddit → Update: signal count +1, stage → evaluation
Run 3: Detect "Acme Corporation" (alias) job posting → Link alias, update categories
Chat:  "What do we know about Acme?" → Full history with buying stage progression
```

**Deduplication:** The signal history hashes content to prevent the same signal from being recorded twice, even if it's found across different runs or sources.

**Trend detection:** The system tracks signal counts per category over time windows and can report which categories are trending up or down.

### 10.7 Human-in-the-Loop Feedback

The feedback system lets you tell the AI which signals are relevant:

```
> /feedback evt_abc123 relevant

> /feedback evt_def456 irrelevant Too generic, just a news article
```

Feedback is stored in `data/memory/feedback.json` and can be used by the Analysis Agent to calibrate future confidence scores. Over time, the system learns which types of signals matter to you.

### 10.8 Reflection & Self-Correction

When `ENABLE_REFLECTION=true` (the default), the Analysis Agent performs a two-pass analysis:

**Pass 1 — Classification:**
Standard signal classification using Claude AI.

**Pass 2 — Reflection:**
The agent calls `reflect_on_quality` which reviews all classified signals and checks for:

| Check | What It Catches | Adjustment |
|-------|----------------|------------|
| Generic content | Sharing/commentary mistaken for buying signals | Confidence reduced by up to 0.2 |
| Very short content | Insufficient evidence for high confidence | Confidence capped at 0.5 |
| Under-rated strong signals | RFP/RFQ/vendor selection language with low confidence | Confidence increased to at least 0.7 |

This prevents false positives from inflating your signal count and ensures genuinely strong signals aren't buried.

### 10.9 Agent-Mode Scheduling

The scheduler supports both modes:

```bash
# Legacy mode (default)
npm run schedule

# Agent mode — set in .env
AGENT_MODE=true
npm run schedule
```

In agent mode, each scheduled run asks the Orchestrator Agent to:
1. Scan all enabled sources
2. Classify and cross-reference findings
3. Record results in persistent memory
4. Generate a summary

This is more adaptive than the fixed pipeline — the agent can dig deeper into promising leads, skip sources that have been producing noise, and leverage historical knowledge.

---

## 11. Guided Setup Wizard

First-time users can run the setup wizard instead of manually editing `.env`:

```bash
npm run setup
```

The wizard walks through each step conversationally:

```
  Welcome to the ICP Buying Signal Monitor Setup!

  I'll help you configure the system step by step.

  Step 1: Anthropic API Key (required for AI classification)
  Enter your Anthropic API key: sk-ant-...

  Step 2: Data Sources (configure at least one)
  Enable Twitter/X? (y/N): y
  Twitter Bearer Token: ...
  Search keywords (comma-separated): supply chain, procurement, TMS

  Enable Reddit? (y/N): y
  Reddit Client ID: ...
  ...

  Step 3: Agent Mode
  Enable agent mode? (Y/n): y

  Step 4: Output Settings
  Output directory (default: ./output):
  Signal confidence threshold 0-1 (default: 0.6):

  Step 5: ICP (Ideal Customer Profile)
  Configure custom ICP? (y/N — N uses default): n

  Setup complete! Run 'npm run chat' to start.
```

The wizard generates a valid `.env` file and optionally a custom `config/icp.json`. No manual file editing required.

If the `chat` command detects that `.env` doesn't exist, it automatically launches the wizard.

---

## 12. Customizing the ICP Profile

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

## 13. Integrating with Downstream Systems

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

## 14. Running Tests

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
| `agents/base-agent.test.ts` | 4 | ReAct loop with mocked Anthropic API, tool execution, error handling, iteration limits |
| `agents/orchestrator.test.ts` | 6 | Planning, delegation, conversation context, one-shot mode, cost tracking |
| `tools/tool-registry.test.ts` | 7 | Registration, role filtering, execution, overwrite behavior |
| `tools/collector-tools.test.ts` | 5 | Collector wrapping, source filtering, keyword filtering, disabled collectors |
| `memory/memory-store.test.ts` | 8 | CRUD operations, persistence, queries with sort/limit/offset |
| `memory/company-memory.test.ts` | 8 | Knowledge accumulation, buying stage tracking, aliases, case-insensitive lookup |
| `conversation/message-formatter.test.ts` | 9 | Signal formatting, table grouping, company profiles, welcome/help/status output |

---

## 15. Troubleshooting

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

### Chat mode says "First-time setup detected"

This happens when `.env` doesn't exist. Either run `npm run setup` to use the wizard, or manually create `.env` from `.env.example`.

### Agent takes too many iterations

Reduce `MAX_AGENT_ITERATIONS` in `.env` (default 15). If the agent is looping on tool calls, check that your API keys are valid and collectors are returning data.

### Memory files are empty

Memory only gets populated when you use agent mode (`npm run chat` or `npm run ask`). The legacy pipeline does not write to the memory system. Also check that `ENABLE_MEMORY=true` (default).

### High token usage

- Use `claude-haiku-4-5-20251001` as `AGENT_MODEL` for cheaper runs
- Reduce `MAX_AGENT_ITERATIONS` to limit reasoning depth
- Set `ENABLE_REFLECTION=false` to skip the second analysis pass
- Use `/status` in chat mode to monitor token usage in real-time

### TypeScript build errors

```bash
# Check for type errors without emitting
npx tsc --noEmit

# Build to dist/
npm run build
```

---

## 16. Extending the System

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

Now add an agent tool as well — register it in the tool registry and make it available to specific agent roles.

---

## Quick Reference

### Commands

| Command | What It Does |
|---------|--------------|
| `npm run chat` | **Interactive conversational mode (primary)** |
| `npm run ask -- "question"` | **One-shot agentic query** |
| `npm run setup` | **Guided first-time setup wizard** |
| `npm run pipeline` | Legacy full run: collect → match → classify → output |
| `npm run schedule` | Start cron scheduler (supports agent mode via `AGENT_MODE=true`) |
| `npm run collect` | Run collectors only |
| `npm run classify -- "text"` | Classify a single snippet |
| `npm test` | Run all tests (61 tests across 10 files) |
| `npm run build` | TypeScript build |

### REPL Slash Commands

| Command | What It Does |
|---------|-------------|
| `/help` | Show available commands |
| `/status` | System status and token usage |
| `/companies` | List tracked companies |
| `/history` | Recent signal history |
| `/feedback <id> <rating>` | Record signal feedback |
| `/export` | Export conversation to JSON |
| `/clear` | Clear conversation context |
| `/quit` | Exit |

### Key Files

| File | Purpose |
|------|---------|
| `.env` | API keys, pipeline settings, agent config |
| `config/icp.json` | Your Ideal Customer Profile |
| `output/latest.json` | Latest run summary |
| `output/events/*.json` | Individual signal events |
| `output/runs/*.jsonl` | Batch output per run |
| `output/pipeline.log` | Application logs |
| `data/memory/companies.json` | Persistent company knowledge |
| `data/memory/signals.json` | Signal history and deduplication |
| `data/memory/preferences.json` | Learned user preferences |
| `data/memory/feedback.json` | User feedback on signals |
