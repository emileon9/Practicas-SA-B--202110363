// Ver P5/services/gateway/src/observability/logger.ts -- mismo patron.
import { trace } from "@opentelemetry/api";
import type { NextFunction, Request, Response } from "express";

type Level = "info" | "warn" | "error";

function currentTraceId(): string | undefined {
  return trace.getActiveSpan()?.spanContext().traceId;
}

export function log(level: Level, message: string, fields: Record<string, unknown> = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: process.env.OTEL_SERVICE_NAME || "ms-users",
    message,
    trace_id: currentTraceId(),
    ...fields,
  };
  (level === "error" ? console.error : console.log)(JSON.stringify(entry));
}

export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on("finish", () => {
    log(res.statusCode >= 500 ? "error" : "info", "http_request", {
      method: req.method,
      path: req.path,
      status_code: res.statusCode,
      duration_ms: Date.now() - start,
    });
  });
  next();
}
