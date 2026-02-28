# Setup / Reconfigure ICP Signal Engine

Run the interactive setup wizard to configure API keys and ICP targeting.

Execute `npm run setup` in `d:\ICP-Signal-Engine`.

The wizard will guide you through:
1. Setting your Anthropic API key (required for AI classification)
2. Setting up data source API keys (LinkedIn/Apify, Twitter, Reddit, GitHub)
3. Defining your ICP profile (target industries, company size, roles, tech stack)
4. Setting your pipeline schedule

After setup, run `/get-leads` to test your configuration with a live pipeline run.

**Already configured?** If you just want to update specific settings, I can read your current `.env` and `config/icp.json` and help you edit them directly.
