// Prueba de carga (Practica 5, seccion I) contra el API Gateway.
// Concurrencia creciente para forzar el HPA (min 2 / max 5 replicas @ 70% CPU)
// y luego descenso a 0 VUs para evidenciar que las replicas bajan de nuevo.
//
// Uso:
//   BASE_URL=http://sa-platform.local k6 run scripts/load-test/k6-script.js
//
// Mientras corre, en otra terminal:
//   kubectl get hpa -n sa-p5 -w
//   kubectl get pods -n sa-p5 -w
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://sa-platform.local";

const errorRate = new Rate("errors");
const latencyTrend = new Trend("custom_latency");

// Rutas reales expuestas por el gateway (ver P4/docs/API.md). Se golpean en
// round-robin para repartir la carga entre los 4 microservicios.
const ENDPOINTS = [
  "/health",
  "/api/users/health",
  "/api/products/health",
  "/api/orders/orders",
  "/api/notifications/notifications",
];

export const options = {
  scenarios: {
    ramping_load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 20 },   // rampa suave inicial
        { duration: "2m", target: 80 },   // concurrencia creciente -> dispara HPA
        { duration: "3m", target: 80 },   // sostiene la carga para que el HPA escale
        { duration: "1m", target: 0 },    // cesa la carga -> HPA debe bajar replicas
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<1500"],
  },
};

export default function () {
  const path = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
  const res = http.get(`${BASE_URL}${path}`, {
    headers: { Host: "sa-platform.local" },
  });

  const ok = check(res, {
    "status es 200": (r) => r.status === 200,
  });
  errorRate.add(!ok);
  latencyTrend.add(res.timings.duration);

  sleep(Math.random() * 0.3);
}

// Resumen minimo exigido por el enunciado: RPS, latencia p95 y % de error.
export function handleSummary(data) {
  const rps = data.metrics.http_reqs ? data.metrics.http_reqs.values.rate : 0;
  const p95 = data.metrics.http_req_duration
    ? data.metrics.http_req_duration.values["p(95)"]
    : 0;
  const errorPct = data.metrics.http_req_failed
    ? data.metrics.http_req_failed.values.rate * 100
    : 0;

  const summaryText =
    `\n=== Resumen de la prueba de carga (sa-platform) ===\n` +
    `Requests por segundo (RPS): ${rps.toFixed(2)}\n` +
    `Latencia p95: ${p95.toFixed(2)} ms\n` +
    `Porcentaje de error: ${errorPct.toFixed(2)}%\n`;

  return {
    stdout: summaryText,
    "scripts/load-test/results/summary.json": JSON.stringify(data, null, 2),
  };
}
