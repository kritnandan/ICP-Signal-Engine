# Check Current Leads (No Re-run)

Show me the leads from the last pipeline run without running the pipeline again.

1. Read `d:\ICP-Signal-Engine\output\latest.json`
2. List all signals found, grouped by strength (strong → moderate → weak)
3. For each signal show: Company | Category | Confidence Score | Source | Key snippet from the signal text
4. Show the `generatedAt` timestamp so I know how fresh the data is
5. List the top 3 companies to contact with a one-line reason for each

If the file is empty (0 signals), say so clearly and suggest running `/get-leads` to fetch fresh data.
