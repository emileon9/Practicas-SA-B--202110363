import client from "prom-client";
import type { NextFunction, Request, Response } from "express";

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duracion de las peticiones HTTP manejadas por ms-users",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 1.5, 3, 5],
  registers: [registry],
});

export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total de peticiones HTTP manejadas por ms-users",
  labelNames: ["method", "route", "status_code"],
  registers: [registry],
});

// Metrica de NEGOCIO (no tecnica): tamano del catalogo de usuarios.
// Comprensible para alguien no tecnico ("cuantos usuarios hay
// registrados"), derivada de un dato real (users.service.ts), no
// inventada.
export const usersCatalogSize = new client.Gauge({
  name: "sa_users_catalog_size",
  help: "Numero de usuarios existentes en el catalogo de ms-users",
  registers: [registry],
});

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    // GraphQL es una unica ruta ("/graphql"): la cardinalidad de la
    // consulta en si (query/mutation) no se usa como label a proposito,
    // ver la restriccion de alta cardinalidad del enunciado de P10.
    const labels = { method: req.method, route: req.path, status_code: String(res.statusCode) };
    httpRequestDuration.observe(labels, durationSeconds);
    httpRequestsTotal.inc(labels);
  });
  next();
}
