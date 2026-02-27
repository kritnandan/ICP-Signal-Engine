import { createInterface } from "readline";
import type { AppConfig } from "../types.js";
import { OrchestratorAgent } from "../agents/orchestrator.js";
import {
  createToolRegistry,
  ToolRegistry,
} from "../tools/tool-registry.js";
import { registerCollectorTools } from "../tools/collector-tools.js";
import { registerAnalysisTools } from "../tools/analysis-tools.js";
import { registerOutputTools } from "../tools/output-tools.js";
import { registerMemoryTools } from "../tools/memory-tools.js";
import { CompanyMemory } from "../memory/company-memory.js";
import { SignalHistory } from "../memory/signal-history.js";
import {
  formatWelcome,
  formatHelp,
  formatStatus,
  formatAgentResult,
  formatCompanyProfile,
  formatAnalysisReportMarkdown,
} from "./message-formatter.js";
import { logger } from "../utils/logger.js";

/**
 * Interactive REPL — readline loop with slash commands and human-in-the-loop.
 */
export class SignalREPL {
  private orchestrator: OrchestratorAgent;
  private toolRegistry: ToolRegistry;
  private companyMemory: CompanyMemory;
  private signalHistory: SignalHistory;
  private rl: ReturnType<typeof createInterface>;
  private running = false;

  constructor(config: AppConfig) {

    // Build tool registry with all tools
    this.toolRegistry = createToolRegistry();
    registerCollectorTools(this.toolRegistry, config);
    registerAnalysisTools(this.toolRegistry, config);
    registerOutputTools(this.toolRegistry, config);
    registerMemoryTools(this.toolRegistry, config.agent.memoryDir);

    // Create orchestrator
    this.orchestrator = new OrchestratorAgent(
      config,
      this.toolRegistry
    );

    // Memory instances for slash commands
    this.companyMemory = new CompanyMemory(config.agent.memoryDir);
    this.signalHistory = new SignalHistory(config.agent.memoryDir);

    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async start(): Promise<void> {
    this.running = true;

    console.log(formatWelcome());

    this.rl.on("close", () => {
      this.running = false;
    });

    while (this.running) {
      const input = await this.prompt("> ");

      if (!input) continue;

      // Handle slash commands
      if (input.startsWith("/")) {
        await this.handleCommand(input);
        continue;
      }

      // Process natural language input
      await this.handleChat(input);
    }
  }

  private prompt(promptText: string): Promise<string> {
    return new Promise((resolve) => {
      if (!this.running) {
        resolve("");
        return;
      }
      this.rl.question(promptText, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  private async handleChat(input: string): Promise<void> {
    try {
      console.log("\n  Thinking...\n");
      const result = await this.orchestrator.chat(input);
      console.log(formatAgentResult(result));
      console.log("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Chat error: ${msg}`);
      console.log(`\n  Error: ${msg}\n`);
    }
  }

  private async handleCommand(input: string): Promise<void> {
    const parts = input.split(/\s+/);
    const cmd = parts[0].toLowerCase();

    switch (cmd) {
      case "/help":
        console.log(formatHelp());
        break;

      case "/status": {
        const tracker = this.orchestrator.getCostTracker();
        const usage = tracker.getTotalUsage();
        console.log(
          formatStatus(
            usage,
            tracker.getRunCount(),
            this.companyMemory.size,
            this.signalHistory.size
          )
        );
        break;
      }

      case "/companies": {
        const companies = this.companyMemory.getTopCompanies(20);
        if (companies.length === 0) {
          console.log(
            "\n  No companies tracked yet. Run a search first!\n"
          );
        } else {
          console.log(`\n  Tracked Companies (${companies.length}):\n`);
          for (const company of companies) {
            console.log(formatCompanyProfile(company));
          }
          console.log("");
        }
        break;
      }

      case "/history": {
        const recent = this.signalHistory.getRecent(20);
        if (recent.length === 0) {
          console.log("\n  No signal history yet.\n");
        } else {
          console.log(`\n  Recent Signals (${recent.length}):\n`);
          for (const sig of recent) {
            console.log(
              `  ${sig.companyName} | ${sig.category} | ${sig.strength} | ${sig.source} | ${sig.timestamp}`
            );
          }
          console.log("");
        }
        break;
      }

      case "/feedback": {
        if (parts.length < 3) {
          console.log(
            "\n  Usage: /feedback <eventId> <relevant|irrelevant|partially_relevant>\n"
          );
          break;
        }
        const eventId = parts[1];
        const feedback = parts[2] as
          | "relevant"
          | "irrelevant"
          | "partially_relevant";
        const comment = parts.slice(3).join(" ") || undefined;

        try {
          await this.toolRegistry.execute("record_feedback", {
            eventId,
            feedback,
            comment,
          });
          console.log(
            `\n  Feedback recorded: ${eventId} = ${feedback}\n`
          );
        } catch {
          console.log("\n  Failed to record feedback.\n");
        }
        break;
      }

      case "/analyze": {
        const topic = parts.slice(1).join(" ");
        const query = topic
          ? `Analyze buying signals related to: ${topic}. Search relevant sources, classify signals, cross-reference with memory, and provide a comprehensive analysis.`
          : `Perform a full buying signal scan. Search all available sources for procurement, supply chain, and logistics buying signals. Classify, cross-reference with memory, and provide a comprehensive analysis with key findings.`;

        console.log(
          `\n  Running analysis${topic ? ` for "${topic}"` : ""}...\n`
        );

        try {
          const result = await this.orchestrator.chat(query);

          // Show summary in console
          console.log(formatAgentResult(result));

          // Generate markdown report
          const markdown = formatAnalysisReportMarkdown(
            result,
            topic || "Full buying signal scan"
          );

          // Save to output/reports/
          const { mkdirSync, writeFileSync } = await import("fs");
          const reportsDir = "./output/reports";
          mkdirSync(reportsDir, { recursive: true });
          const timestamp = new Date()
            .toISOString()
            .replace(/[:.]/g, "-");
          const filename = `${reportsDir}/analysis_${timestamp}.md`;
          writeFileSync(filename, markdown, "utf-8");

          console.log(`\n  Report saved to: ${filename}\n`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error(`Analysis error: ${msg}`);
          console.log(`\n  Analysis failed: ${msg}\n`);
        }
        break;
      }

      case "/export": {
        const ctx = this.orchestrator.getConversationContext();
        const exportData = {
          exportedAt: new Date().toISOString(),
          turns: ctx.turns.length,
          conversation: ctx.turns,
        };
        const filename = `export_${Date.now()}.json`;
        const { writeFileSync } = await import("fs");
        writeFileSync(filename, JSON.stringify(exportData, null, 2));
        console.log(`\n  Exported to ${filename}\n`);
        break;
      }

      case "/clear":
        this.orchestrator.resetConversation();
        console.log("\n  Conversation cleared.\n");
        break;

      case "/quit":
      case "/exit":
        console.log("\n  Goodbye!\n");
        this.running = false;
        this.rl.close();
        break;

      default:
        console.log(`\n  Unknown command: ${cmd}. Type /help for options.\n`);
    }
  }
}
