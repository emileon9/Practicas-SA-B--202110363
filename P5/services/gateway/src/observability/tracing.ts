// Inicializacion de OpenTelemetry (Practica 10). Este archivo DEBE
// importarse antes que cualquier otro modulo de la app (ver server.ts):
// las auto-instrumentaciones de Node parchean los modulos (http, express)
// en el momento en que se cargan por primera vez, asi que si "./app" se
// importara primero, express ya estaria cargado sin instrumentar.
//
// Exporta por OTLP/HTTP (no gRPC) al OpenTelemetry Collector
// (P10/observability/otel-collector) para no agregar una dependencia
// nativa extra solo por el transporte.
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

const otlpEndpoint =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
  "http://otel-collector.observability.svc.cluster.local:4318";

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || "gateway",
    [ATTR_SERVICE_VERSION]: process.env.IMAGE_TAG || "unknown",
  }),
  traceExporter: new OTLPTraceExporter({
    url: `${otlpEndpoint}/v1/traces`,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Evita instrumentar el propio middleware de "fs" (ruido, sin valor
      // para este proyecto) -- mismo criterio de "no llenar el tablero
      // con metricas sin proposito" que pide el enunciado para Grafana,
      // aplicado tambien a las trazas.
      "@opentelemetry/instrumentation-fs": { enabled: false },
    }),
  ],
});

sdk.start();

// Apagado limpio: evita perder los ultimos spans al recibir SIGTERM
// (el mismo caso real que ya maneja Kubernetes al reemplazar un Pod
// durante un rollout -- ver P8/helm/gateway/templates/rollout.yaml).
process.on("SIGTERM", () => {
  sdk
    .shutdown()
    .catch((err) => console.error("Error cerrando OpenTelemetry SDK", err));
});
