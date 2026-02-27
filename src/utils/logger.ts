import winston from "winston";

const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf(({ level, message, timestamp: ts, ...rest }) => {
  const extra = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : "";
  return `${ts} [${level}] ${message}${extra}`;
});

export function createLogger(level = "info"): winston.Logger {
  return winston.createLogger({
    level,
    format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), logFormat),
    transports: [
      new winston.transports.Console({
        format: combine(colorize(), logFormat),
      }),
      new winston.transports.File({
        filename: "output/pipeline.log",
        maxsize: 5_000_000,
        maxFiles: 3,
      }),
    ],
  });
}

export const logger = createLogger(process.env.LOG_LEVEL || "info");
