# Diagrama del flujo de telemetría (Práctica 10)

Enfocado en el **recorrido real de una petición y sus tres señales**
(traza, métrica, log), no en la arquitectura general del sistema (esa ya
existe en [P8/docs/gitops-flow.md](../../P8/docs/gitops-flow.md)).

```mermaid
flowchart TD
    Client(["Cliente HTTP"]) -->|"GET /api/orders/orders"| Gateway

    subgraph sa-p5["namespace sa-p5"]
        Gateway["gateway\n(instrumentado: traza + métricas + logs JSON)"]
        Orders["ms-orders\n(instrumentado)"]
        Users["ms-users\n(instrumentado: query user(id) nueva)"]
        Gateway -->|"proxy HTTP, traceparent propagado\npor auto-instrumentación http"| Orders
        Orders -->|"httpx POST /graphql, traceparent\npropagado por instrumentation-httpx"| Users
    end

    Gateway -.->|"OTLP/HTTP :4318 (trazas)"| Collector
    Orders -.->|"OTLP/HTTP :4318 (trazas)"| Collector
    Users -.->|"OTLP/HTTP :4318 (trazas)"| Collector

    subgraph observability["namespace observability"]
        Collector["OTel Collector"]
        Tempo["Tempo\n(almacena la traza completa:\ngateway → ms-orders → ms-users)"]
        Prometheus["Prometheus\n(scrapea /metrics vía ServiceMonitor,\ncada 15s)"]
        Loki["Loki\n(recibe logs JSON vía Promtail,\nlabels: trace_id, level, service)"]
        Grafana["Grafana\n(datasources: Prometheus + Loki + Tempo,\nderivedFields: log → traza; tracesToLogsV2: traza → log)"]
        Promtail["Promtail\n(DaemonSet, lee stdout de los Pods)"]

        Collector -->|"OTLP/gRPC :4317"| Tempo
        Promtail -->|"push"| Loki
        Prometheus --> Grafana
        Loki --> Grafana
        Tempo --> Grafana
    end

    Gateway -.->|"stdout JSON\n(incluye trace_id)"| Promtail
    Orders -.->|"stdout JSON\n(incluye trace_id)"| Promtail
    Users -.->|"stdout JSON\n(incluye trace_id)"| Promtail

    Gateway -.->|"/metrics scrapeado"| Prometheus
    Orders -.->|"/metrics scrapeado"| Prometheus
    Users -.->|"/metrics scrapeado"| Prometheus

    Rollout["Argo Rollouts\n(AnalysisTemplate, provider: prometheus)"] -->|"PromQL cada 30s,\nfiltrado por pod_template_hash"| Prometheus

    classDef svc fill:#2f6f4f,color:#fff,stroke:#1c4531;
    classDef obs fill:#1f3a5f,color:#fff,stroke:#13253d;
    classDef ext fill:#8a4b08,color:#fff,stroke:#5c3205;

    class Gateway,Orders,Users svc;
    class Collector,Tempo,Prometheus,Loki,Grafana,Promtail obs;
    class Client,Rollout ext;
```

## Recorrido síntoma → causa (lo que debe poder demostrarse)

1. **Alerta dispara** (`GatewayLatencySLOBurnRate`, ver
   [alerts.md](alerts.md)) → Alertmanager → (PENDIENTE: receiver real).
2. **Dashboard de Grafana** (panel "Latencia") muestra el p95 elevado y
   en qué ventana de tiempo.
3. **Explorar Tempo** desde Grafana, filtrando por el servicio `gateway`
   y ese rango de tiempo → se identifica una traza lenta real, con sus 3
   spans (`gateway` → `ms-orders` → `ms-users`).
4. **Saltar de la traza al log** (botón "Logs for this span" en Grafana,
   habilitado por `tracesToLogsV2` en el datasource de Tempo, ver
   [kube-prometheus-stack/values.yaml](../observability/kube-prometheus-stack/values.yaml))
   → el log JSON exacto de esa petición, con su `trace_id`, en Loki.
5. **Y en sentido inverso**: desde un log en Loki con un `trace_id`
   visible, el `derivedField` configurado en el datasource de Loki arma
   el enlace directo de vuelta a esa traza en Tempo.

## Estado real

PENDIENTE — este recorrido no se ha ejecutado todavía contra el clúster
real (el stack no está desplegado). Ver
[P10/docs/operation-report.md](operation-report.md), campo "Recorrido
hasta la causa", y [P10/scripts/](../scripts) para los scripts
preparados para generar la prueba real.
