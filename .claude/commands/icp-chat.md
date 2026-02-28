# Chat with ICP Agent

Start an interactive conversation with the ICP buying signal AI agent.

Execute `npm run chat` in `d:\ICP-Signal-Engine`.

The agent can:
- Search all your configured sources live (LinkedIn, Twitter, Reddit, GitHub, RSS)
- Analyze signals and match them against your ICP profile
- Answer questions like "Which companies are showing strong buying signals this week?"
- Help you research specific companies or industries
- Export findings to Excel

**Useful chat commands once inside:**
- `/status` — show pipeline status
- `/companies` — list companies in memory
- `/analyze` — deep analysis of current signals
- `/export` — export to Excel
- `/feedback good` or `/feedback bad` — improve the AI
- `/quit` — exit chat

Note: This requires the `ANTHROPIC_API_KEY` to be set in `.env`.
