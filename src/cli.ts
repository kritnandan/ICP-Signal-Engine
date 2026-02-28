import { Command } from "commander";
import { loadConfig } from "./config.js";
import { Pipeline } from "./pipeline/pipeline.js";
import { Scheduler } from "./pipeline/scheduler.js";
import { createCollectors } from "./collectors/index.js";
import { logger } from "./utils/logger.js";

const program = new Command();

program
  .name("icp-signal-monitor")
  .description(
    "Watch online sources for procurement, supply chain, and logistics buying signals"
  )
  .version("1.0.0");

program
  .command("collect")
  .description("Run all collectors and output raw events (no classification)")
  .action(async () => {
    const config = loadConfig();
    const collectors = createCollectors(config);

    logger.info(`Running ${collectors.length} collectors...`);

    for (const collector of collectors) {
      try {
        const events = await collector.collect();
        logger.info(`${collector.name}: ${events.length} events`);
        for (const event of events.slice(0, 3)) {
          console.log(
            JSON.stringify(
              { id: event.id, source: event.source, title: event.title },
              null,
              2
            )
          );
        }
      } catch (err) {
        logger.error(
          `${collector.name} failed: ${err instanceof Error ? err.message : err}`
        );
      }
    }
  });

program
  .command("classify")
  .description("Classify a single text snippet as a buying signal")
  .argument("<text>", "Text to classify")
  .option("-s, --source <source>", "Source platform", "manual")
  .action(async (text: string, opts: { source: string }) => {
    const config = loadConfig();

    if (!config.anthropicApiKey) {
      logger.error("ANTHROPIC_API_KEY required for classification");
      process.exit(1);
    }

    const { SignalClassifier } = await import(
      "./engines/signal-classifier.js"
    );
    const classifier = new SignalClassifier(config.anthropicApiKey);

    const event = {
      id: "manual_test",
      source: opts.source as "linkedin",
      contentType: "company_post" as const,
      url: "",
      body: text,
      collectedAt: new Date().toISOString(),
      metadata: {},
    };

    const result = await classifier.classify(event);
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("pipeline")
  .description("Run the full pipeline once (collect → match → classify → output)")
  .action(async () => {
    const config = loadConfig();
    const pipeline = new Pipeline(config);
    const result = await pipeline.run();
    console.log("\nPipeline Result:");
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("schedule")
  .description("Start the scheduled pipeline runner")
  .action(() => {
    const config = loadConfig();
    const scheduler = new Scheduler(config);

    process.on("SIGINT", () => {
      logger.info("Shutting down scheduler...");
      scheduler.stop();
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      logger.info("Shutting down scheduler...");
      scheduler.stop();
      process.exit(0);
    });

    scheduler.start();
  });

program
  .command("chat")
  .description("Start interactive conversational mode (agentic AI)")
  .action(async () => {
    const config = loadConfig();

    if (!config.anthropicApiKey) {
      logger.error("ANTHROPIC_API_KEY required for chat mode");
      process.exit(1);
    }

    // Check if onboarding is needed
    const { OnboardingWizard } = await import(
      "./conversation/onboarding.js"
    );
    if (OnboardingWizard.needsSetup()) {
      console.log("\n  First-time setup detected.\n");
      const wizard = new OnboardingWizard();
      await wizard.run();
      return;
    }

    const { SignalREPL } = await import("./conversation/repl.js");
    const repl = new SignalREPL(config);
    await repl.start();
  });

program
  .command("ask")
  .description("Ask a one-shot question (agentic AI)")
  .argument("<question>", "Question to ask the AI")
  .action(async (question: string) => {
    const config = loadConfig();

    if (!config.anthropicApiKey) {
      logger.error("ANTHROPIC_API_KEY required for ask mode");
      process.exit(1);
    }

    const { OrchestratorAgent } = await import(
      "./agents/orchestrator.js"
    );
    const { createToolRegistry } = await import(
      "./tools/tool-registry.js"
    );
    const { registerCollectorTools } = await import(
      "./tools/collector-tools.js"
    );
    const { registerAnalysisTools } = await import(
      "./tools/analysis-tools.js"
    );
    const { registerOutputTools } = await import(
      "./tools/output-tools.js"
    );
    const { registerMemoryTools } = await import(
      "./tools/memory-tools.js"
    );

    const toolRegistry = createToolRegistry();
    registerCollectorTools(toolRegistry, config);
    registerAnalysisTools(toolRegistry, config);
    registerOutputTools(toolRegistry, config);
    registerMemoryTools(toolRegistry, config.agent.memoryDir);

    const orchestrator = new OrchestratorAgent(config, toolRegistry);
    const result = await orchestrator.ask(question);

    const { formatAgentResult } = await import(
      "./conversation/message-formatter.js"
    );
    console.log(formatAgentResult(result));
  });

program
  .command("setup")
  .description("Run the guided setup wizard")
  .action(async () => {
    const { OnboardingWizard } = await import(
      "./conversation/onboarding.js"
    );
    const wizard = new OnboardingWizard();
    await wizard.run();
  });

program
  .command("export")
  .description("Export the latest classified signals to an Excel file")
  .option("-o, --output <path>", "Output file path (default: output/signals_report.xlsx)")
  .action(async (opts: { output?: string }) => {
    const config = loadConfig();
    const { ExcelExporter } = await import("./output/excel.js");
    const exporter = new ExcelExporter(config.outputDir);
    try {
      exporter.exportToExcel(opts.output);
    } catch (e) {
      logger.error("Export failed");
      process.exit(1);
    }
  });

program
  .command("dashboard")
  .description("Generate a daily summary dashboard of latest signals")
  .action(async () => {
    const config = loadConfig();

    if (!config.anthropicApiKey) {
      logger.error("ANTHROPIC_API_KEY required for dashboard mode");
      process.exit(1);
    }

    logger.info("Generating daily dashboard via AI analysis...");
    const { OrchestratorAgent } = await import("./agents/orchestrator.js");
    const { createToolRegistry } = await import("./tools/tool-registry.js");
    const { registerAnalysisTools } = await import("./tools/analysis-tools.js");
    const { registerMemoryTools } = await import("./tools/memory-tools.js");
    const { registerOutputTools } = await import("./tools/output-tools.js");

    const toolRegistry = createToolRegistry();
    registerAnalysisTools(toolRegistry, config);
    registerMemoryTools(toolRegistry, config.agent.memoryDir);
    registerOutputTools(toolRegistry, config);

    const orchestrator = new OrchestratorAgent(config, toolRegistry);

    // Explicit predefined query
    const query = "Analyze the latest collected signals and create a markdown daily summary dashboard of high-confidence buying signals. Group them by category and highlight the most promising companies.";
    const result = await orchestrator.ask(query);

    const { formatAgentResult } = await import("./conversation/message-formatter.js");
    console.log(formatAgentResult(result));
  });

program.parse();
