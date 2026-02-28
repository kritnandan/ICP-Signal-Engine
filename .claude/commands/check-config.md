# Check Configuration Status

Show me the current configuration status — what's working and what's missing.

1. Read `d:\ICP-Signal-Engine\.env` (redact actual key values, just show if set or empty)
2. Read `d:\ICP-Signal-Engine\config\icp.json`
3. Read `d:\ICP-Signal-Engine\output\latest.json` to check last run

**Report on:**

### API Keys Status
Show a table: Source | Key Variable | Status (✓ Set / ✗ Missing)
- Anthropic (ANTHROPIC_API_KEY) — required for AI
- Apify (APIFY_API_TOKEN) — LinkedIn scraping
- Twitter (TWITTER_BEARER_TOKEN)
- Reddit (REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET)
- GitHub (GITHUB_TOKEN)
- Apollo.io (APOLLO_API_KEY) — contact enrichment

### ICP Profile Summary
- Target industries (how many configured)
- Company size range
- Target roles
- Geography
- Tech stack signals

### Last Run Stats
- When was the last run?
- How many signals were found?
- Which sources fired?

### Health Score
Give me an overall health score (e.g. "3/6 sources active") and the #1 thing I should fix to get more leads.
