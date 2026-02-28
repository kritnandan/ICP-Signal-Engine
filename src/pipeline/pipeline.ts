import { writeFileSync, rmSync, mkdirSync } from "fs";
import { join } from "path";
import type {
  AppConfig,
  Collector,
  RawEvent,
  BuyingSignalEvent,
} from "../types.js";
import { ICPMatcher } from "../engines/icp-matcher.js";
import { SignalClassifier } from "../engines/signal-classifier.js";
import { OutputWriter } from "../output/writer.js";
import { createCollectors } from "../collectors/index.js";
import { generateEventId } from "../utils/id.js";
import { logger } from "../utils/logger.js";

const PIPELINE_VERSION = "1.0.0";

export interface PipelineResult {
  runId: string;
  startedAt: string;
  completedAt: string;
  totalCollected: number;
  totalSignals: number;
  totalNoise: number;
  outputFile: string;
  eventsBySource: Record<string, number>;
  eventsByCategory: Record<string, number>;
}

/**
 * Main pipeline orchestrator.
 *
 * Ties together:
 * 1. Collectors → gather raw events from all configured sources
 * 2. ICP Matcher → score each event against the ICP
 * 3. Signal Classifier → determine if it's a buying signal
 * 4. Output Writer → write structured JSON
 */
export class Pipeline {
  private config: AppConfig;
  private collectors: Collector[];
  private icpMatcher: ICPMatcher;
  private classifier: SignalClassifier;
  private writer: OutputWriter;

  constructor(config: AppConfig) {
    this.config = config;
    this.collectors = createCollectors(config);
    this.icpMatcher = new ICPMatcher(config.icpConfigPath);
    this.classifier = new SignalClassifier(config.anthropicApiKey);
    this.writer = new OutputWriter(config.outputDir);
  }

  async run(): Promise<PipelineResult> {
    const runId = generateEventId("run");
    const startedAt = new Date().toISOString();

    logger.info(`Pipeline run ${runId} started`);
    logger.info(
      `Active collectors: ${this.collectors.map((c) => c.name).join(", ") || "none"}`
    );

    // ── Step 1: Collect raw events ──
    const rawEvents = await this.collectAll();
    logger.info(`Collected ${rawEvents.length} raw events`);

    const rawDir = join(this.config.outputDir, "raw");
    mkdirSync(rawDir, { recursive: true });
    const tempRawFile = join(rawDir, "temp_raw_events.json");

    try {
      writeFileSync(tempRawFile, JSON.stringify(rawEvents, null, 2), "utf-8");
      logger.info(`Temporarily saved raw collected data to ${tempRawFile}`);
    } catch (e) {
      logger.error(`Failed to save temp raw events: ${e}`);
    }

    // Apply per-run cap
    const capped = rawEvents.slice(0, this.config.maxEventsPerRun);
    if (rawEvents.length > this.config.maxEventsPerRun) {
      logger.warn(
        `Capped from ${rawEvents.length} to ${this.config.maxEventsPerRun} events`
      );
    }

    // ── Step 2: ICP matching ──
    const withICP = capped.map((event) => ({
      event,
      company: this.icpMatcher.match(event),
    }));

    // Filter out events with very low ICP score
    const icpFiltered = withICP.filter((item) => item.company.matchScore > 0);
    logger.info(
      `${icpFiltered.length}/${capped.length} events passed ICP filter`
    );

    // ── Step 3: Signal classification ──
    const classifications = await this.classifier.classifyBatch(
      icpFiltered.map((item) => item.event)
    );

    // ── Step 4: Assemble and output ──
    const signalEvents: BuyingSignalEvent[] = [];

    for (const { event, company } of icpFiltered) {
      const signal = classifications.get(event.id);
      if (!signal) continue;

      // Filter by confidence threshold
      if (
        signal.isSignal &&
        signal.confidence >= this.config.signalConfidenceThreshold
      ) {
        const buyingEvent: BuyingSignalEvent = {
          eventId: event.id,
          timestamp: new Date().toISOString(),
          source: {
            platform: event.source,
            contentType: event.contentType,
            url: event.url,
            author: event.author,
            authorRole: event.authorRole,
          },
          company,
          signal,
          rawContent: {
            title: event.title,
            body: event.body,
            publishedAt: event.publishedAt,
          },
          pipeline: {
            collectedAt: event.collectedAt,
            processedAt: new Date().toISOString(),
            pipelineVersion: PIPELINE_VERSION,
          },
        };

        this.writer.writeEvent(buyingEvent);
        signalEvents.push(buyingEvent);
      }
    }

    const outputFile = this.writer.writeBatch(signalEvents, runId);
    const completedAt = new Date().toISOString();

    const result: PipelineResult = {
      runId,
      startedAt,
      completedAt,
      totalCollected: rawEvents.length,
      totalSignals: signalEvents.length,
      totalNoise: rawEvents.length - signalEvents.length,
      outputFile,
      eventsBySource: this.countBy(signalEvents, (e) => e.source.platform),
      eventsByCategory: this.countBy(signalEvents, (e) => e.signal.category),
    };

    // ── Step 5: Cleanup temporary raw data ──
    try {
      rmSync(tempRawFile, { force: true });
      logger.info(`Successfully deleted temporary raw collector data from ${tempRawFile}`);
    } catch (e) {
      logger.error(`Failed to delete temporary raw file: ${e}`);
    }

    logger.info(
      `Pipeline run ${runId} completed: ${result.totalSignals} signals from ${result.totalCollected} collected`
    );

    return result;
  }

  private async collectAll(): Promise<RawEvent[]> {
    const results = await Promise.allSettled(
      this.collectors.map((c) => c.collect())
    );

    const events: RawEvent[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        events.push(...result.value);
      } else {
        logger.error(
          `Collector ${this.collectors[i].name} failed: ${result.reason}`
        );
      }
    }

    return events;
  }

  private countBy(
    events: BuyingSignalEvent[],
    keyFn: (e: BuyingSignalEvent) => string
  ): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const e of events) {
      const key = keyFn(e);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }
}
