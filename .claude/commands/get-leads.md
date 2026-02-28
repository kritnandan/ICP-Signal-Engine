# Run Full Pipeline — Get Leads

Run the complete ICP buying signal pipeline end-to-end.

Execute `npm run pipeline` in `d:\ICP-Signal-Engine`.

After it finishes:
1. Read `d:\ICP-Signal-Engine\output\latest.json`
2. Display all signals found in a clean table with columns: Company | Signal Strength | Category | Confidence | Source | Summary
3. Group results by signal strength (strong first, then moderate, then weak)
4. Show total counts by source and category
5. Tell me which companies to prioritize for outreach today

If 0 signals were found, check the `.env` file at `d:\ICP-Signal-Engine\.env` and tell me which API keys are missing or empty, and what I need to configure to start getting real data.
