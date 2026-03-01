import { readFileSync } from "fs";
import { join } from "path";
import * as xlsx from "xlsx";
import { logger } from "../utils/logger.js";
import type { BuyingSignalEvent } from "../types.js";

export class ExcelExporter {
    private outputDir: string;

    constructor(outputDir: string) {
        this.outputDir = outputDir;
    }

    exportToExcel(outputPath?: string): string {
        const defaultOutputPath = outputPath || join(this.outputDir, "signals_report.xlsx");
        const latestPath = join(this.outputDir, "latest.json");

        try {
            const data = readFileSync(latestPath, "utf-8");
            const summary = JSON.parse(data);
            const events: BuyingSignalEvent[] = summary.events || [];

            if (events.length === 0) {
                logger.warn("No events found in latest.json to export.");
                return defaultOutputPath;
            }

            // Format data for Excel
            const rows = events.map(e => {
                const enriched = e as any;
                const contactsStr = enriched.enrichment?.contacts
                    ? enriched.enrichment.contacts.map((c: any) => `${c.name} (${c.title}): ${c.email}`).join(" | ")
                    : "No Contacts";

                return {
                    "Event ID": e.eventId,
                    "Timestamp": e.timestamp,
                    "Source Platform": e.source.platform,
                    "Source Content Type": e.source.contentType,
                    "URL": e.source.url,
                    "Company Name": e.company.companyName,
                    "ICP Match Score": e.company.matchScore,
                    "Is Signal?": e.signal.isSignal ? "Yes" : "No",
                    "Confidence": e.signal.confidence,
                    "Category": e.signal.category,
                    "Strength": e.signal.strength,
                    "Buying Stage": e.signal.buyingStage,
                    "Apollo Contacts": contactsStr,
                    "Snippet": e.rawContent.body.substring(0, 500) + (e.rawContent.body.length > 500 ? "..." : ""),
                    "Reasoning": e.signal.reasoning,
                    "Keywords": e.signal.keywords?.join(", ") || "",
                    "Suggested Actions": e.signal.suggestedActions?.join("; ") || ""
                };
            });

            // Create a new workbook and add the worksheet
            const workbook = xlsx.utils.book_new();
            const worksheet = xlsx.utils.json_to_sheet(rows);

            // Add the worksheet to the workbook
            xlsx.utils.book_append_sheet(workbook, worksheet, "Buying Signals");

            // Write the workbook to a file
            xlsx.writeFile(workbook, defaultOutputPath);

            logger.info(`Successfully exported ${rows.length} signals to ${defaultOutputPath}`);
            return defaultOutputPath;
        } catch (error) {
            logger.error(`Failed to export to Excel: ${error instanceof Error ? error.message : error}`);
            throw error;
        }
    }
}
