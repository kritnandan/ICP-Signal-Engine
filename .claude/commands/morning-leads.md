# Morning Leads Briefing

Run the complete ICP buying signal pipeline to collect fresh leads for today, then give me a full morning briefing.

**Steps to execute:**

1. Run `npm run pipeline` in `d:\ICP-Signal-Engine` to collect and classify all signals
2. Read `d:\ICP-Signal-Engine\output\latest.json` to get the results
3. Run `npm run export` to generate the Excel file
4. Read any recent files in `d:\ICP-Signal-Engine\output\runs\` for the batch details

**Then deliver a morning briefing in this format:**

---
## 🌅 Morning Leads Briefing — [Today's Date]

### Top Leads to Contact Today
List the top 5–10 companies with the strongest buying signals. For each one show:
- Company name
- Signal strength (strong / moderate / weak)
- What signal was detected (summary of the content)
- Category (e.g. procurement_sourcing, tms_logistics)
- Buying stage they appear to be in
- Recommended action (e.g. "Call VP of Procurement", "Send case study on WMS")

### Signal Summary
- Total signals found: X
- Strong signals: X
- Moderate signals: X
- Sources that fired: LinkedIn, Twitter, Reddit, etc.

### Today's Priority
Tell me the single most important company to reach out to today and exactly why.

### Excel Report
Confirm the Excel file path so I can open it.
---

Keep the briefing crisp and actionable — I want to know who to call, not just data.
