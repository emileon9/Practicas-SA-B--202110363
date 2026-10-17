// Logging estructurado en JSON con trace_id (Practica 10). Se escribe a
// stdout -- Promtail (P10/observability/loki/promtail-values.yaml) lo
// recolecta del propio contenedor, sin que este servicio le hable
// directamente a Loki. Sin dependencia nueva (pino, winston): un
// JSON.stringify basta para lo que pide el enunciado y evita una
// abstraccion que el proyecto no necesitaba antes.
import { trace } from "@opentelemetry/api";
import type { NextFunction, Request, Response } from "express";

type Level = "info" | "warn" | "error";

function currentTraceId(): string | undefined {
  const span = trace.getActiveSpan();
  return span?.spanContext().traceId;
}

export function log(level: Level, message: string, fields: Record<string, unknown> = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: process.env.OTEL_SERVICE_NAME || "gateway",
    message,
    trace_id: currentTraceId(),
    ...fields,
  };
  // stdout para info/warn, stderr para error: convencion estandar de
  // contenedores, independiente de que ambos terminen en el mismo log de
  // Kubernetes.
  (level === "error" ? console.error : console.log)(JSON.stringify(entry));
}

/** Middleware: un registro JSON por peticion, con el trace_id de su propio span HTTP. */
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
