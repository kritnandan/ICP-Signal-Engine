# ICP Buying Signal Monitor

## Project Overview
Monitors online sources (LinkedIn, Twitter/X, Reddit, HackerNews, GitHub, RSS/blogs) for procurement, supply chain, and logistics buying signals from Ideal Customer Profile (ICP) accounts. Outputs structured JSON events for downstream consumption (CRM, alerts, playbooks).

## Architecture
```
src/
├── types.ts              # All TypeScript types, Zod schemas
├── config.ts             # Environment-based configuration loader
├── collectors/           # Source-specific data collectors
│   ├── base.ts           # Abstract base collector
│   ├── linkedin.ts       # LinkedIn API collector
│   ├── twitter.ts        # Twitter/X API v2 collector
│   ├── reddit.ts         # Reddit OAuth collector
│   ├── github.ts         # GitHub releases/issues collector
│   ├── rss.ts            # RSS/Atom + HackerNews collector
│   └── index.ts          # Collector factory
├── engines/
│   ├── icp-matcher.ts    # Rule-based ICP matching engine
│   ├── signal-classifier.ts  # Claude-powered signal classification
│   └── index.ts
├── pipeline/
│   ├── pipeline.ts       # Main orchestrator: collect → match → classify → output
│   ├── scheduler.ts      # Cron-based scheduling
│   └── index.ts
├── output/
│   ├── writer.ts         # JSON/JSONL output writer with validation
│   └── index.ts
├── utils/
│   ├── logger.ts         # Winston-based logging
│   └── id.ts             # Event ID generator
├── cli.ts                # Commander CLI entry point
└── index.ts              # Library exports
```

## Key Commands
- `npm run dev` — Run CLI in development mode
- `npm run pipeline` — Run full pipeline once
- `npm run schedule` — Start cron-based scheduler
- `npm run collect` — Run collectors only (no classification)
- `npm run classify "text"` — Classify a single text snippet
- `npm test` — Run tests
- `npm run build` — TypeScript build

## Configuration
- Copy `.env.example` to `.env` and fill in API keys
- ICP criteria defined in `config/icp.json`
- Signal confidence threshold: `SIGNAL_CONFIDENCE_THRESHOLD` (default 0.6)

## Conventions
- TypeScript strict mode, ESM modules
- Zod for runtime validation of output events
- Winston for structured logging
- All collectors extend `BaseCollector`
- Claude Sonnet used for signal classification with rule-based fallback
- Output: individual JSON files + JSONL batch files + latest.json summary
