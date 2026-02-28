# Start Automated Scheduler

Start the ICP pipeline scheduler to automatically collect and classify signals on a schedule.

Execute `npm run schedule` in `d:\ICP-Signal-Engine`.

Before starting, read `d:\ICP-Signal-Engine\.env` and tell me:
1. What cron schedule is configured (`SCHEDULE_CRON` env var) — or default if not set
2. What time that means in plain English (e.g. "every 6 hours", "daily at 8am")
3. Confirm which collectors are active (have API keys set)

The scheduler will keep running — press Ctrl+C to stop it. Each scheduled run saves results to `output/latest.json` and appends to the runs history.

**Tip:** To change the schedule, edit the `SCHEDULE_CRON` variable in `.env`. Standard cron format: `0 8 * * *` = every day at 8:00 AM.
