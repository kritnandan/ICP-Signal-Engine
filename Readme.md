# ICP Buying Signal Monitor

> **Your AI-powered sales radar** — automatically watches LinkedIn, Twitter, Reddit, GitHub, and news feeds to find companies that are actively looking to buy supply chain, procurement, or logistics software. Powered by Claude AI.

---

## Table of Contents

1. [What This Does (Plain English)](#1-what-this-does-plain-english)
2. [How It Works — The Big Picture](#2-how-it-works--the-big-picture)
3. [What You Get Out of It](#3-what-you-get-out-of-it)
4. [Prerequisites — What You Need Before Starting](#4-prerequisites--what-you-need-before-starting)
5. [Installation](#5-installation)
6. [First-Time Setup](#6-first-time-setup)
7. [Running the Application](#7-running-the-application)
8. [Using This with Claude Code — Slash Commands](#8-using-this-with-claude-code--slash-commands)
   - [8.1 Your Morning Routine (One Command)](#81-your-morning-routine-one-command)
   - [8.2 All Available Slash Commands](#82-all-available-slash-commands)
   - [8.3 Natural Language (No Slash Commands)](#83-natural-language-no-slash-commands)
9. [Understanding Your ICP Profile](#9-understanding-your-icp-profile)
10. [All Configuration Options](#10-all-configuration-options)
11. [Understanding the Output Files](#11-understanding-the-output-files)
12. [Signal Categories Explained](#12-signal-categories-explained)
13. [What is a "Buying Signal"?](#13-what-is-a-buying-signal)
14. [Data Sources — Where It Looks](#14-data-sources--where-it-looks)
15. [Project File Structure](#15-project-file-structure)
16. [API Keys You Need](#16-api-keys-you-need)
17. [Frequently Asked Questions](#17-frequently-asked-questions)
18. [Troubleshooting](#18-troubleshooting)

---

## 1. What This Does (Plain English)

Imagine you sell supply chain software. Every day, thousands of companies post on LinkedIn, Twitter, Reddit, and blogs saying things like:

> *"We're evaluating a new TMS platform..."*
> *"Our team is struggling with inventory visibility..."*
> *"We're issuing an RFP for a warehouse management system..."*

These are **buying signals** — signs that a company is actively looking to buy something your product can solve. The problem is that finding these signals manually is impossible. There are millions of posts every day.

**This tool does it automatically.** It:

1. **Watches** multiple platforms simultaneously (LinkedIn, Twitter/X, Reddit, GitHub, RSS/news feeds)
2. **Filters** posts to only show ones from companies that match your ideal customer profile (ICP)
3. **Analyzes** each post using Claude AI to determine if it's a genuine buying signal
4. **Scores** each signal by confidence, strength, and where the company is in their buying journey
5. **Stores** everything in structured files your sales team can act on
6. **Remembers** what it has seen before, so you can track a company's journey over time
7. **Lets you chat** with an AI assistant that knows all your signal data

In short: **it's like having a full-time analyst monitoring the internet 24/7 for sales opportunities.**

---

## 2. How It Works — The Big Picture

```
+-------------------------------------------------------------+
|                      INTERNET SOURCES                       |
|  LinkedIn  |  Twitter/X  |  Reddit  |  GitHub  |  RSS/Blogs|
+----------------------------+--------------------------------+
                             |  Raw posts, tweets, articles
                             v
+-------------------------------------------------------------+
|                   STEP 1: COLLECTION                        |
|  Gathers content from all enabled platforms using their APIs|
+----------------------------+--------------------------------+
                             |
                             v
+-------------------------------------------------------------+
|                   STEP 2: ICP MATCHING                      |
|  Checks if each event comes from a company that fits your   |
|  Ideal Customer Profile (industry, size, role, tech stack)  |
+----------------------------+--------------------------------+
                             |  Only matched companies pass
                             v
+-------------------------------------------------------------+
|                   STEP 3: AI CLASSIFICATION                 |
|  Claude AI reads each post and decides:                     |
|  - Is this a real buying signal? (yes/no)                   |
|  - How confident is the AI? (0-100%)                        |
|  - What category? (TMS, WMS, Procurement, ERP, etc.)        |
|  - How strong is the signal? (strong/moderate/weak)         |
|  - What stage of buying? (Awareness to Decision)            |
|  - What should sales do next?                               |
+----------------------------+--------------------------------+
                             |
                             v
+-------------------------------------------------------------+
|                   STEP 4: ENRICHMENT (Optional)             |
|  If Apollo.io key is provided, finds contact details for    |
|  key decision-makers at matched companies                   |
+----------------------------+--------------------------------+
                             |
                             v
+-------------------------------------------------------------+
|                   STEP 5: OUTPUT                            |
|  Saves results as:                                          |
|  - JSON files (machine-readable, CRM-ready)                 |
|  - Excel spreadsheet (human-readable)                       |
|  - AI-generated markdown dashboard reports                  |
+-------------------------------------------------------------+
```

The system also has an **AI memory layer** that remembers every company and signal it has ever seen. Over time, it builds a picture of where each company is in their buying journey.

---

## 3. What You Get Out of It

For every confirmed buying signal, the system outputs:

| Field | What It Means |
|---|---|
| **Company Name** | Which company posted this |
| **Match Score** | How well this company fits your ICP (0-100%) |
| **Signal Category** | What type of software they might be buying (TMS, WMS, ERP, etc.) |
| **Signal Strength** | Strong / Moderate / Weak |
| **Buying Stage** | Awareness > Research > Evaluation > Decision > Implementation |
| **Confidence** | How sure the AI is this is a real signal (0-100%) |
| **AI Reasoning** | Why the AI thinks this is a buying signal |
| **Suggested Actions** | What your sales team should do next |
| **Source URL** | Direct link to the post that triggered this signal |
| **Author & Role** | Who posted it and their job title |
| **Contact Details** | Key decision-makers at the company (if Apollo enrichment enabled) |

---

## 4. Prerequisites — What You Need Before Starting

Before installing, make sure you have these:

### Required
- **Node.js v18 or higher** — The programming runtime. Download from [nodejs.org](https://nodejs.org)
- **An Anthropic API Key** — This is what powers the AI analysis. Get one at [console.anthropic.com](https://console.anthropic.com)

### Optional (for each data source you want to enable)
- **Apify API Token** — For LinkedIn scraping (LinkedIn's own API is very restricted). Get at [apify.com](https://apify.com)
- **Twitter/X Bearer Token** — For Twitter monitoring. From [developer.twitter.com](https://developer.twitter.com)
- **Reddit Client ID + Secret** — For Reddit monitoring. From [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps)
- **GitHub Token** — For GitHub monitoring. From GitHub Settings > Developer Settings > Personal Access Tokens
- **RSS Feeds** — Just public URLs, no API key needed
- **Apollo.io API Key** — For contact enrichment. From [apollo.io](https://apollo.io)

> **Minimum to get started:** You only need the Anthropic API key + at least one data source. Reddit and RSS feeds are the easiest to set up with free accounts.

---

## 5. Installation

Open a terminal (Command Prompt on Windows, Terminal on Mac/Linux) and run:

```bash
# Go to the project folder
cd d:/ICP-Signal-Engine

# Install all dependencies
npm install
```

That's it. The project is now installed.

---

## 6. First-Time Setup

### Option A: Guided Setup Wizard (Easiest)

Run the interactive setup wizard. It will ask you questions and create all config files automatically:

```bash
npm run setup
```

The wizard will ask you:
1. Your Anthropic API key
2. Which data sources to enable (Twitter, Reddit, GitHub, RSS)
3. Your API credentials for each source
4. Output preferences

### Option B: Manual Setup

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` and fill in your API keys** (use any text editor like Notepad or VS Code):
   ```
   ANTHROPIC_API_KEY=sk-ant-your-key-here

   # Add at least one data source:
   REDDIT_CLIENT_ID=your-reddit-client-id
   REDDIT_CLIENT_SECRET=your-reddit-secret
   REDDIT_SUBREDDITS=supplychain,logistics,procurement,warehousing
   ```

3. **Review your ICP profile** in `config/icp.json` (see Section 9 for details)

---

## 7. Running the Application

### 7.1 Quick Start (Recommended for Beginners)

Run a full scan right now and see results:

```bash
npm run pipeline
```

This runs once through all your enabled sources, analyzes everything, and saves results to the `output/` folder.

---

### 7.2 Chat Mode — Talk to the AI

The most powerful way to use this tool. Start an interactive conversation with the AI assistant:

```bash
npm run chat
```

Once running, you can type natural language questions like:

```
> What are the strongest buying signals from this week?
> Find companies looking for TMS solutions
> What do we know about Acme Corp?
> Show me companies in the evaluation stage
> Run a full scan across all sources
> Analyze procurement signals on Reddit
```

#### Chat Mode Slash Commands

While in chat mode, these special commands are available:

| Command | What It Does |
|---|---|
| `/help` | Show all available commands |
| `/status` | Show AI usage stats and cost summary |
| `/companies` | List all companies tracked in memory |
| `/history` | Show recent signals discovered |
| `/analyze` | Run a full buying signal analysis |
| `/analyze TMS` | Run analysis focused on a specific topic |
| `/feedback <id> relevant` | Mark a signal as relevant |
| `/export` | Export current conversation to JSON |
| `/clear` | Clear conversation history |
| `/quit` | Exit the chat |

---

### 7.3 Run a Full Pipeline Scan

Run the complete 5-step pipeline once:

```bash
npm run pipeline
```

Output will be in `output/` directory.

---

### 7.4 Auto-Scheduled Monitoring

Run the system continuously, automatically scanning every 4 hours (configurable):

```bash
npm run schedule
```

To stop it, press `Ctrl+C`.

To change the schedule, set `CRON_SCHEDULE` in your `.env` file:
```
# Every 4 hours (default):
CRON_SCHEDULE=0 */4 * * *

# Every day at 8am:
CRON_SCHEDULE=0 8 * * *

# Every hour:
CRON_SCHEDULE=0 * * * *
```

---

### 7.5 Export Results to Excel

Convert the latest pipeline results to an Excel spreadsheet:

```bash
npm run export
```

The file is saved to `output/signals_report.xlsx` and contains two sheets:
- **Signals** — All detected buying signals with full details
- **Summary** — Aggregated statistics by category, source, strength

To save to a custom path:
```bash
npm run export -- --output ./my-report.xlsx
```

---

### 7.6 Generate a Daily Dashboard

Generate a formatted markdown summary of all recent signals using AI:

```bash
npm run dashboard
```

The AI analyzes your latest data and produces a human-readable report grouped by signal category, highlighting the most promising companies.

---

### 7.7 Ask a One-Shot Question

Ask a single question without entering chat mode:

```bash
npm run ask "Which companies are showing ERP migration signals?"
npm run ask "Summarize all signals from the past week"
npm run ask "What buying signals have we seen for Acme Corporation?"
```

---

### 7.8 Run Collectors Only (No AI Analysis)

Just fetch raw data from all sources without AI classification:

```bash
npm run collect
```

Useful for testing if your API keys are working.

---

### 7.9 Classify a Single Piece of Text

Test the AI classifier on any text you paste:

```bash
npm run classify "We are currently issuing an RFP for a new transportation management system to replace our legacy SAP TM module"
```

The AI will analyze it and return:
- Is this a buying signal? (yes/no)
- Confidence score
- Category (TMS, WMS, etc.)
- Signal strength
- Buying stage
- Suggested actions

---

## 8. Using This with Claude Code (Recommended)

This application is designed to work natively with **Claude Code** — the AI-powered CLI assistant. You can control the entire application by talking to Claude Code naturally.

### Setup in Claude Code

Just open this project folder in Claude Code. Claude Code can read all the code and understand the full system.

### Example Claude Code Conversations

```
"Run the pipeline and show me the results"
  -> Claude Code runs: npm run pipeline

"Start the chat interface so I can query signals"
  -> Claude Code runs: npm run chat

"Export the latest results to Excel"
  -> Claude Code runs: npm run export

"Show me all the companies tracked in memory"
  -> Claude Code reads data/memory/companies.json

"Change my ICP to focus on companies with 1000+ employees"
  -> Claude Code edits config/icp.json

"Add healthcare to my target industries"
  -> Claude Code edits config/icp.json

"Enable Reddit monitoring with subreddits: supplychain, logistics"
  -> Claude Code edits .env file

"Generate a dashboard report"
  -> Claude Code runs: npm run dashboard

"Run a full analysis and save a report"
  -> Claude Code runs: npm run ask "Analyze all signals..."
```

### Running Commands Through Claude Code

Claude Code can run any npm script directly. Just describe what you want:

| What you say | What runs |
|---|---|
| "Run the full pipeline" | `npm run pipeline` |
| "Start chat mode" | `npm run chat` |
| "Schedule automatic runs" | `npm run schedule` |
| "Export to Excel" | `npm run export` |
| "Test this text as a signal" | `npm run classify "text here"` |
| "Run tests" | `npm test` |
| "Build the project" | `npm run build` |

---

## 9. Understanding Your ICP Profile

Your **Ideal Customer Profile (ICP)** tells the system which companies are worth monitoring. It's defined in `config/icp.json`.

### What's in the Default ICP

The default profile targets **mid-to-large companies in supply chain and procurement industries**:

```json
{
  "name": "Supply Chain & Procurement ICP",
  "industries": [
    "Manufacturing", "Retail", "Consumer Goods",
    "Food & Beverage", "Automotive", "Pharmaceuticals",
    "Healthcare", "Logistics & Transportation"
  ],
  "minEmployees": 500,
  "maxEmployees": 500000,
  "minRevenue": 100,
  "geographies": ["United States", "Canada", "United Kingdom", "Germany"],
  "techStack": ["SAP", "Oracle", "Microsoft Dynamics", "Coupa", "Blue Yonder"],
  "targetRoles": [
    "VP Supply Chain", "VP Procurement", "Chief Procurement Officer",
    "Director of Logistics", "Supply Chain Manager"
  ]
}
```

### Customizing Your ICP

Edit `config/icp.json` directly, or tell Claude Code what to change:

**To target only Manufacturing companies:**
```json
"industries": ["Manufacturing", "Automotive", "Aerospace & Defense"]
```

**To target smaller companies:**
```json
"minEmployees": 100,
"maxEmployees": 5000
```

**To add custom detection rules:**
```json
"customRules": [
  {
    "field": "body",
    "operator": "regex",
    "value": "RFP|RFQ|vendor selection|system evaluation"
  }
]
```

---

## 10. All Configuration Options

All settings go in your `.env` file. Copy `.env.example` to `.env` to get started.

### Core Settings

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | *(required)* | Your Claude AI API key |
| `OUTPUT_DIR` | `./output` | Where to save results |
| `LOG_LEVEL` | `info` | Logging verbosity (`debug`, `info`, `warn`, `error`) |
| `SIGNAL_CONFIDENCE_THRESHOLD` | `0.6` | Minimum AI confidence to count as a signal (0.0-1.0) |
| `MAX_EVENTS_PER_RUN` | `500` | Max events to process per pipeline run |
| `CRON_SCHEDULE` | `0 */4 * * *` | How often to auto-scan (cron format) |

### LinkedIn

| Variable | Description |
|---|---|
| `APIFY_API_TOKEN` | Apify token for LinkedIn scraping (recommended) |
| `LINKEDIN_COMPANY_IDS` | Comma-separated company slugs to monitor (e.g., `microsoft,oracle`) |
| `LINKEDIN_KEYWORDS` | Keywords to search for (e.g., `procurement,supply chain`) |

### Twitter/X

| Variable | Description |
|---|---|
| `TWITTER_BEARER_TOKEN` | Twitter API v2 Bearer Token |
| `TWITTER_KEYWORDS` | Search keywords (e.g., `supply chain,TMS,WMS,logistics`) |
| `TWITTER_ACCOUNTS` | Specific accounts to monitor (e.g., `@company_ops`) |

### Reddit

| Variable | Description |
|---|---|
| `REDDIT_CLIENT_ID` | Reddit app client ID |
| `REDDIT_CLIENT_SECRET` | Reddit app client secret |
| `REDDIT_SUBREDDITS` | Subreddits to watch (e.g., `supplychain,logistics,procurement`) |

### GitHub

| Variable | Description |
|---|---|
| `GITHUB_TOKEN` | Personal access token |
| `GITHUB_REPOS` | Repos to watch (e.g., `apache/superset`) |
| `GITHUB_KEYWORDS` | Keywords to filter issues/releases |

### RSS Feeds

| Variable | Description |
|---|---|
| `RSS_FEEDS` | Comma-separated RSS feed URLs |

### Contact Enrichment

| Variable | Description |
|---|---|
| `APOLLO_API_KEY` | Apollo.io API key for finding decision-maker contacts |

### Agent/AI Settings

| Variable | Default | Description |
|---|---|---|
| `AGENT_MODE` | `false` | Use AI agent for scheduled runs (smarter but costs more) |
| `AGENT_MODEL` | `claude-sonnet-4-6` | Which Claude model to use |
| `MAX_AGENT_ITERATIONS` | `15` | Max steps the AI agent can take per task |
| `ENABLE_MEMORY` | `true` | Remember companies and signals between runs |
| `ENABLE_REFLECTION` | `true` | AI reviews and second-guesses its own classifications |
| `MEMORY_DIR` | `./data/memory` | Where to store the AI's memory |

---

## 11. Understanding the Output Files

After a pipeline run, find your results in the `output/` directory:

```
output/
+-- latest.json              <- Summary of the most recent run
+-- signals_report.xlsx      <- Excel export (after: npm run export)
+-- runs/
|   +-- run_abc123.jsonl     <- All signals from one run (one per line)
+-- events/
|   +-- signal_xyz789.json   <- Individual signal files
+-- reports/
    +-- analysis_2026-03-01.md  <- AI-generated markdown reports
```

### The `latest.json` Summary File

```json
{
  "runId": "run_abc123",
  "generatedAt": "2026-03-01T09:00:00Z",
  "totalEvents": 245,
  "signalCount": 12,
  "companies": ["Acme Corp", "GlobalTech Inc"],
  "byCategory": {
    "tms_logistics": 5,
    "wms_warehouse": 3,
    "procurement_sourcing": 4
  },
  "bySource": {
    "reddit": 8,
    "rss": 4
  },
  "byStrength": {
    "strong": 3,
    "moderate": 7,
    "weak": 2
  }
}
```

### A Single Signal Event (example from `events/` or `runs/`)

```json
{
  "eventId": "sig_abc123",
  "timestamp": "2026-03-01T09:00:00Z",
  "source": {
    "platform": "reddit",
    "url": "https://reddit.com/r/supplychain/comments/xyz...",
    "author": "john_doe_logistics",
    "authorRole": "VP Supply Chain"
  },
  "company": {
    "companyName": "GlobalTech Inc",
    "matchScore": 0.75,
    "matchedCriteria": ["target_role", "content_relevance_high", "tech_stack:SAP"]
  },
  "signal": {
    "isSignal": true,
    "confidence": 0.87,
    "category": "tms_logistics",
    "strength": "strong",
    "buyingStage": "evaluation",
    "reasoning": "Post explicitly mentions issuing RFP for TMS platform to replace current system",
    "keywords": ["RFP", "TMS", "transportation management"],
    "suggestedActions": [
      "Reach out to VP Supply Chain immediately",
      "Send relevant TMS case studies",
      "Request a product demo"
    ]
  },
  "rawContent": {
    "title": "Looking for TMS recommendations",
    "body": "We're currently issuing an RFP for a new TMS...",
    "publishedAt": "2026-03-01T08:30:00Z"
  },
  "enrichment": {
    "contacts": [
      {
        "name": "Jane Smith",
        "title": "VP Supply Chain",
        "email": "j.smith@globaltech.com",
        "linkedinUrl": "https://linkedin.com/in/janesmith"
      }
    ]
  }
}
```

---

## 12. Signal Categories Explained

The AI classifies every signal into one of these categories:

| Category | What It Means | Example Trigger |
|---|---|---|
| **planning_visibility** | Demand planning, S&OP, control towers, supply visibility | "We need better demand forecasting" |
| **inventory_optimization** | Inventory management, safety stock, replenishment | "Dealing with too many stockouts" |
| **procurement_sourcing** | Strategic sourcing, e-procurement, spend management | "Evaluating e-sourcing platforms" |
| **tms_logistics** | Transportation management, freight, carrier management | "Issuing RFP for a TMS system" |
| **wms_warehouse** | Warehouse management, fulfillment centers, DC operations | "Moving to a new WMS" |
| **s2p_transformation** | Source-to-pay, procure-to-pay, AP automation | "Automating our P2P process" |
| **erp_migration** | ERP changes, SAP/Oracle migrations, core system changes | "Migrating from SAP ECC to S/4HANA" |
| **supplier_risk** | Supplier risk management, SRM, compliance | "Need better supplier visibility" |
| **network_design** | Supply chain network design, distribution strategy | "Redesigning our DC network" |
| **analytics_reporting** | Supply chain analytics, reporting, data platforms | "Building a supply chain data lake" |
| **general_operations** | General operational improvements | "Improving our supply chain processes" |

---

## 13. What is a "Buying Signal"?

A buying signal is any online content that suggests a company is **actively looking to buy** something.

### Signal Strength Levels

| Strength | What It Means | Example |
|---|---|---|
| **Strong** | Explicit buying language — RFP, RFQ, vendor evaluation | "We issued an RFP for a new TMS" |
| **Moderate** | Clear pain point, researching solutions | "We're struggling with transportation visibility" |
| **Weak** | General domain interest, no clear buying intent | "Great article on supply chain optimization" |

### Buying Stage Progression

The system tracks which stage of the buying journey a company is in:

```
AWARENESS  ->  RESEARCH  ->  EVALUATION  ->  DECISION  ->  IMPLEMENTATION
```

| Stage | What's Happening | What Sales Should Do |
|---|---|---|
| **Awareness** | Company recognizes they have a problem | Educational content, thought leadership |
| **Research** | Actively learning about solutions | Send relevant guides, offer to answer questions |
| **Evaluation** | Comparing vendors, running demos | Request meeting, send case studies |
| **Decision** | Choosing a vendor | Push for contract, offer incentives |
| **Implementation** | Deploying a solution | Wait for renewal opportunity |

---

## 14. Data Sources — Where It Looks

### LinkedIn
- Company posts from your target company list
- Executive posts from supply chain/procurement leaders
- Job listings that indicate technology purchases
- **Requires:** Apify API token (free tier available)

### Twitter/X
- Tweets from monitored accounts
- Keyword searches across all public tweets
- **Requires:** Twitter API v2 Bearer Token (free tier available)

### Reddit
- Posts and discussions in subreddits like r/supplychain, r/logistics, r/procurement
- Configured subreddits scanned for new posts
- **Requires:** Reddit API credentials (free)

### GitHub
- Releases and issues in supply chain/logistics open-source projects
- Discussions about technology adoption
- **Requires:** GitHub Personal Access Token (free)

### RSS / Blogs / HackerNews
- Industry news from company blogs, trade publications
- HackerNews discussions about relevant technology
- **Requires:** Just public feed URLs (no API key needed)

---

## 15. Project File Structure

```
ICP-Signal-Engine/
|
+-- .env                    <- YOUR API KEYS (create from .env.example)
+-- .env.example            <- Template for API keys
+-- config/
|   +-- icp.json            <- YOUR IDEAL CUSTOMER PROFILE
|
+-- src/                    <- Application source code
|   +-- cli.ts              <- Command-line interface (all npm run commands)
|   +-- config.ts           <- Reads your .env settings
|   +-- types.ts            <- Data structure definitions
|   |
|   +-- collectors/         <- Gets data from each platform
|   |   +-- linkedin.ts     <- LinkedIn data collector
|   |   +-- twitter.ts      <- Twitter/X data collector
|   |   +-- reddit.ts       <- Reddit data collector
|   |   +-- github.ts       <- GitHub data collector
|   |   +-- rss.ts          <- RSS/HackerNews collector
|   |
|   +-- engines/            <- Core processing logic
|   |   +-- icp-matcher.ts       <- Checks if company fits your ICP
|   |   +-- signal-classifier.ts <- AI-powered signal detection
|   |
|   +-- agents/             <- AI agent system
|   |   +-- orchestrator.ts <- Main AI brain / coordinator
|   |   +-- research.ts     <- Agent that searches for data
|   |   +-- analysis.ts     <- Agent that classifies signals
|   |   +-- memory-agent.ts <- Agent that queries memory
|   |
|   +-- memory/             <- Persistent storage
|   |   +-- company-memory.ts    <- Tracks knowledge about companies
|   |   +-- signal-history.ts    <- Records all signals seen
|   |   +-- user-preferences.ts  <- Saves your preferences
|   |
|   +-- conversation/       <- Interactive chat system
|   |   +-- repl.ts         <- The chat loop (npm run chat)
|   |   +-- onboarding.ts   <- First-time setup wizard
|   |
|   +-- output/             <- Result writers
|   |   +-- writer.ts            <- Writes JSON/JSONL files
|   |   +-- excel.ts             <- Exports to Excel
|   |   +-- summary-generator.ts <- Creates summary files
|   |
|   +-- pipeline/           <- The main processing pipeline
|   |   +-- pipeline.ts     <- Runs collect -> match -> classify -> output
|   |   +-- scheduler.ts    <- Runs pipeline on a schedule (cron)
|   |
|   +-- tools/              <- AI agent tools
|       +-- collector-tools.ts   <- Tools for searching platforms
|       +-- analysis-tools.ts    <- Tools for classifying signals
|       +-- memory-tools.ts      <- Tools for reading/writing memory
|       +-- output-tools.ts      <- Tools for saving results
|
+-- data/
|   +-- memory/             <- AI memory storage (auto-created)
|       +-- companies.json  <- All companies ever seen
|       +-- signals.json    <- All signals ever found
|       +-- feedback.json   <- Your feedback on signals
|       +-- preferences.json <- Your preferences
|
+-- output/                 <- All results (auto-created)
|   +-- latest.json         <- Latest run summary
|   +-- signals_report.xlsx <- Excel export
|   +-- runs/               <- Full results by run
|   +-- reports/            <- AI-generated markdown reports
|
+-- tests/                  <- Automated tests
+-- package.json            <- Project configuration & npm scripts
+-- Readme.md               <- This file
```

---

## 16. API Keys You Need

Here's a summary of where to get each API key:

| Key | Where to Get It | Cost | Required? |
|---|---|---|---|
| **Anthropic API Key** | [console.anthropic.com](https://console.anthropic.com) | Pay per use (~$0.003/1K tokens) | **YES** |
| **Apify API Token** | [apify.com](https://apify.com) | Free tier available | For LinkedIn |
| **Twitter Bearer Token** | [developer.twitter.com](https://developer.twitter.com) | Free tier available | For Twitter |
| **Reddit Client ID/Secret** | [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps) | Free | For Reddit |
| **GitHub Token** | GitHub Settings > Developer Settings | Free | For GitHub |
| **Apollo.io API Key** | [apollo.io](https://apollo.io) | Free tier available | For contacts |

> **Cost estimate:** Running the full pipeline once with 100 events costs approximately $0.05-0.15 in Anthropic API calls. A daily automated run costs roughly $0.50-2.00/day depending on how many events are collected.

---

## 17. Frequently Asked Questions

**Q: I don't have any API keys yet. Can I still test the system?**

A: Yes! Start by setting up Reddit (free) and RSS feeds (no API key needed). RSS feeds with public URLs work immediately with just your Anthropic API key.

**Q: How do I add RSS feeds?**

A: In your `.env` file, add:
```
RSS_FEEDS=https://www.supplychaindive.com/feeds/news/,https://www.logisticsmgmt.com/rss
```

**Q: The pipeline ran but found 0 signals. Why?**

A: Check that: (1) at least one data source is enabled and API keys are valid, (2) your ICP isn't too narrow, (3) the confidence threshold isn't too high (try lowering `SIGNAL_CONFIDENCE_THRESHOLD` to `0.4`).

**Q: How is this different from Google Alerts?**

A: Google Alerts just sends you raw links. This system reads the content, uses AI to determine if it's a genuine buying signal, scores the company against your ICP, tells you what stage of buying they're in, and suggests what to do next. It also builds memory over time.

**Q: Can I customize what counts as a "buying signal"?**

A: Yes! Customize the ICP file to add custom rules. The AI classification is also configurable via the confidence threshold setting.

**Q: How do I track a specific company?**

A: In chat mode, ask: "What do we know about Acme Corporation?" You can also add Acme Corp's LinkedIn company ID to `LINKEDIN_COMPANY_IDS` in `.env`.

**Q: Is my data safe?**

A: All data is stored locally on your machine in the `data/memory/` and `output/` folders. Content is sent to Anthropic's API for AI analysis (subject to their privacy policy). No data is sent anywhere else.

**Q: Can I run this on a server to monitor 24/7?**

A: Yes! Run `npm run schedule` on any server. It will automatically run every 4 hours (or on your custom cron schedule) and save results locally.

**Q: What's the difference between `npm run pipeline` and `npm run chat`?**

A: `pipeline` runs a fixed automated scan and saves results. `chat` opens an interactive AI assistant that can answer questions, do custom searches, and work with your signal history conversationally.

**Q: How much does it cost to run?**

A: The only paid component is the Anthropic API. A typical daily scan costs $0.50-2.00. Reddit, GitHub, and RSS feeds are free. LinkedIn requires the Apify free tier. You can set `SIGNAL_CONFIDENCE_THRESHOLD=0.8` to process fewer events and reduce costs.

---

## 18. Troubleshooting

### "ANTHROPIC_API_KEY required" error
Make sure your `.env` file exists and has `ANTHROPIC_API_KEY=your-key-here`. Run `npm run setup` to create it interactively.

### "No events collected" or collectors skipping
Check that your API keys are correct in `.env`. Run `npm run collect` to test collectors individually and see which ones are active.

### LinkedIn not working
LinkedIn requires an Apify token. Make sure `APIFY_API_TOKEN` is set in `.env`.

### Pipeline runs but finds 0 signals
- Lower the confidence threshold: set `SIGNAL_CONFIDENCE_THRESHOLD=0.4` in `.env`
- Check your ICP is not too narrow (try adding more industries to `config/icp.json`)
- Make sure data sources are collecting events (run `npm run collect` first to test)

### Excel export fails
Run `npm run pipeline` first to generate `output/latest.json`. The export command reads from the pipeline output.

### Out of memory or slow performance
Lower `MAX_EVENTS_PER_RUN` in `.env` to process fewer events per run.

### How to view detailed logs
Set `LOG_LEVEL=debug` in `.env` for detailed step-by-step logging.

---

## Quick Reference Card

```bash
# First time setup
npm install
npm run setup

# Most useful commands
npm run chat          # Interactive AI assistant (recommended)
npm run pipeline      # Run full scan once
npm run schedule      # Auto-scan every 4 hours
npm run export        # Save results to Excel
npm run dashboard     # Generate daily summary report
npm run collect       # Test data collection only

# One-shot AI queries
npm run ask "Show strongest signals this week"
npm run ask "What companies are evaluating TMS?"

# Test a signal manually
npm run classify "We are issuing an RFP for warehouse management"

# Development
npm test              # Run tests
npm run build         # Compile TypeScript
```

---

*Built with Claude AI (Anthropic), TypeScript, and Node.js. Designed for B2B sales teams monitoring supply chain, procurement, and logistics software markets.*
