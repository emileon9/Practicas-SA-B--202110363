// Metricas tecnicas (latencia, errores, saturacion) expuestas en /metrics
// para que Prometheus las scrapee directamente (no via el OTel Collector
// -- ver la nota de responsabilidad en
// P10/observability/otel-collector/values.yaml).
import client from "prom-client";
import type { NextFunction, Request, Response } from "express";

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry }); // saturacion: CPU/memoria/event-loop-lag del proceso Node

export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duracion de las peticiones HTTP manejadas por el gateway",
  labelNames: ["method", "route", "status_code"],
  // Buckets pensados para un servicio HTTP tipico (no para jobs batch):
  // mismo orden de magnitud que P8/tests/load/k6-script.js usa como
  // umbral (p95 < 1500ms).
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 1.5, 3, 5],
  registers: [registry],
});

export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total de peticiones HTTP manejadas por el gateway",
  labelNames: ["method", "route", "status_code"],
  registers: [registry],
});

/**
 * Middleware de metricas. Usa `req.route`/el path montado en vez de
 * `req.originalUrl` a proposito: el enunciado de P10 prohibe
 * explicitamente etiquetas de alta cardinalidad (nunca un ID de usuario o
 * de peticion como label) -- "/api/orders/orders" es una cardinalidad
 * fija y pequena; "/api/orders/orders/58213" no lo seria si el gateway
 * expusiera rutas con parametros variables.
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    const route = req.baseUrl || req.path.split("/").slice(0, 3).join("/") || req.path;
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };
    httpRequestDuration.observe(labels, durationSeconds);
    httpRequestsTotal.inc(labels);
  });
  next();
}
