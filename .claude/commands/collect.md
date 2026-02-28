# Collect Raw Signals

Collect raw signals from all configured data sources without running the full pipeline.

Execute `npm run collect` in `d:\ICP-Signal-Engine`.

After collection:
1. Read the most recent file in `d:\ICP-Signal-Engine\output\raw\` to see what was collected
2. Show a breakdown: how many events came from each source (LinkedIn, Twitter, Reddit, GitHub, RSS, HackerNews)
3. Show a sample of 3–5 interesting events
4. Tell me which sources returned data and which ones are not configured (missing API keys)

This is useful for testing that your API connections are working before running the full pipeline.
