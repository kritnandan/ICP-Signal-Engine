import { createInterface } from "readline";
import { writeFileSync, existsSync } from "fs";

/**
 * Guided first-run setup wizard.
 * Conversational .env and ICP config generation so users don't need to edit files manually.
 */
export class OnboardingWizard {
  private rl: ReturnType<typeof createInterface>;

  constructor() {
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  private ask(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  async run(): Promise<boolean> {
    console.log("\n  Welcome to the ICP Buying Signal Monitor Setup!\n");
    console.log("  I'll help you configure the system step by step.\n");

    const envPath = ".env";
    const icpPath = "./config/icp.json";

    // Check if already configured
    if (existsSync(envPath)) {
      const overwrite = await this.ask(
        "  A .env file already exists. Overwrite? (y/N): "
      );
      if (overwrite.toLowerCase() !== "y") {
        console.log("  Keeping existing configuration.\n");
        this.rl.close();
        return false;
      }
    }

    const envLines: string[] = [];

    // Anthropic API key
    console.log(
      "\n  Step 1: Anthropic API Key (required for AI classification)"
    );
    const apiKey = await this.ask("  Enter your Anthropic API key: ");
    envLines.push(`ANTHROPIC_API_KEY=${apiKey}`);

    // Data sources
    console.log(
      "\n  Step 2: Data Sources (configure at least one)"
    );

    // Twitter
    const useTwitter = await this.ask(
      "  Enable Twitter/X? (y/N): "
    );
    if (useTwitter.toLowerCase() === "y") {
      const token = await this.ask("  Twitter Bearer Token: ");
      const keywords = await this.ask(
        "  Search keywords (comma-separated): "
      );
      const accounts = await this.ask(
        "  Twitter accounts to follow (comma-separated, optional): "
      );
      envLines.push(`TWITTER_BEARER_TOKEN=${token}`);
      if (keywords) envLines.push(`TWITTER_KEYWORDS=${keywords}`);
      if (accounts) envLines.push(`TWITTER_ACCOUNTS=${accounts}`);
    }

    // Reddit
    const useReddit = await this.ask("  Enable Reddit? (y/N): ");
    if (useReddit.toLowerCase() === "y") {
      const clientId = await this.ask("  Reddit Client ID: ");
      const clientSecret = await this.ask(
        "  Reddit Client Secret: "
      );
      const subreddits = await this.ask(
        "  Subreddits (comma-separated, e.g., supplychain,logistics): "
      );
      envLines.push(`REDDIT_CLIENT_ID=${clientId}`);
      envLines.push(`REDDIT_CLIENT_SECRET=${clientSecret}`);
      if (subreddits)
        envLines.push(`REDDIT_SUBREDDITS=${subreddits}`);
    }

    // GitHub
    const useGithub = await this.ask("  Enable GitHub? (y/N): ");
    if (useGithub.toLowerCase() === "y") {
      const token = await this.ask("  GitHub Token: ");
      const repos = await this.ask(
        "  Repos to watch (comma-separated, e.g., owner/repo): "
      );
      envLines.push(`GITHUB_TOKEN=${token}`);
      if (repos) envLines.push(`GITHUB_REPOS=${repos}`);
    }

    // RSS
    const useRSS = await this.ask("  Enable RSS feeds? (y/N): ");
    if (useRSS.toLowerCase() === "y") {
      const feeds = await this.ask(
        "  RSS feed URLs (comma-separated): "
      );
      if (feeds) envLines.push(`RSS_FEEDS=${feeds}`);
    }

    // Agent mode
    console.log("\n  Step 3: Agent Mode");
    const useAgent = await this.ask(
      "  Enable agent mode? (Y/n): "
    );
    envLines.push(
      `AGENT_MODE=${useAgent.toLowerCase() !== "n" ? "true" : "false"}`
    );

    // Output settings
    console.log("\n  Step 4: Output Settings");
    const outputDir = await this.ask(
      "  Output directory (default: ./output): "
    );
    if (outputDir) envLines.push(`OUTPUT_DIR=${outputDir}`);

    const threshold = await this.ask(
      "  Signal confidence threshold 0-1 (default: 0.6): "
    );
    if (threshold)
      envLines.push(`SIGNAL_CONFIDENCE_THRESHOLD=${threshold}`);

    // Write .env
    envLines.push(""); // trailing newline
    writeFileSync(envPath, envLines.join("\n"), "utf-8");
    console.log(`\n  .env file created at ${envPath}`);

    // ICP Configuration
    console.log("\n  Step 5: ICP (Ideal Customer Profile)");
    const customICP = await this.ask(
      "  Configure custom ICP? (y/N — N uses default): "
    );

    if (customICP.toLowerCase() === "y") {
      const name = await this.ask("  ICP name: ");
      const industries = await this.ask(
        "  Target industries (comma-separated): "
      );
      const minEmployees = await this.ask(
        "  Minimum company size (employees): "
      );
      const maxEmployees = await this.ask(
        "  Maximum company size (employees): "
      );

      const icp = {
        name: name || "Custom ICP",
        industries: industries
          ? industries.split(",").map((s) => s.trim())
          : [],
        minEmployees: parseInt(minEmployees) || 100,
        maxEmployees: parseInt(maxEmployees) || 500000,
        geographies: ["US", "UK", "Canada"],
        techStack: [],
        targetRoles: [
          "VP Supply Chain",
          "VP Procurement",
          "VP Logistics",
          "Director Supply Chain",
          "Director Procurement",
          "Head of Supply Chain",
        ],
        excludeCompanies: [],
        customRules: [
          {
            field: "body",
            operator: "regex",
            value:
              "RFP|RFQ|RFI|vendor selection|platform evaluation|digital transformation",
          },
        ],
      };

      writeFileSync(icpPath, JSON.stringify(icp, null, 2), "utf-8");
      console.log(`  ICP config created at ${icpPath}`);
    }

    console.log("\n  Setup complete! Run 'npm run chat' to start.\n");
    this.rl.close();
    return true;
  }

  /**
   * Check if initial setup is needed.
   */
  static needsSetup(): boolean {
    return !existsSync(".env");
  }
}
