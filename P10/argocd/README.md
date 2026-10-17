# ArgoCD — stack de observabilidad (Práctica 10)

## Cómo se conecta con el bootstrap de P9

P9 (`P9/terraform/argocd.tf`) crea `sa-platform-root`, el app-of-apps de
la plataforma de negocio (`AppProject sa-platform`, namespace `sa-p5`).
El stack de observabilidad usa un **AppProject separado**
(`sa-observability`, ver
[project/sa-observability-project.yaml](project/sa-observability-project.yaml))
porque necesita recursos de clúster (CRDs y RBAC de Prometheus Operator)
que `sa-platform` prohíbe explícitamente (`clusterResourceWhitelist: []`).

Por ahora esto se aplica como un paso **adicional** al bootstrap de P9,
no integrado en el mismo `terraform apply` (ver
`P10/README.md`, sección de pendientes, para la justificación y el plan
de integrarlo a `P9/bootstrap/bootstrap.sh` más adelante):

```bash
kubectl apply -f P10/argocd/project/sa-observability-project.yaml
kubectl apply -f P10/argocd/applications/root.yaml
```

A partir de ahí, `sa-observability-root` sincroniza todo lo demás en esta
carpeta sin pasos manuales adicionales.

## Qué sincroniza cada Application

| Archivo | Application | Qué instala |
|---|---|---|
| [applications/kube-prometheus-stack.yaml](applications/kube-prometheus-stack.yaml) | `sa-observability-kube-prometheus-stack` | Prometheus + Alertmanager + Grafana + Prometheus Operator |
| [applications/tempo.yaml](applications/tempo.yaml) | `sa-observability-tempo` | Tempo (trazas) |
| [applications/loki.yaml](applications/loki.yaml) | `sa-observability-loki` + `sa-observability-promtail` | Loki (logs) + Promtail (recolección) |
| [applications/otel-collector.yaml](applications/otel-collector.yaml) | `sa-observability-otel-collector` | OpenTelemetry Collector (recepción OTLP, único punto de entrada de trazas) |

Orden real de sincronización (`sync-wave`): kube-prometheus-stack (-1) →
Tempo + Loki (0) → Promtail + OTel Collector (1). Ver
[P10/docs/telemetry-flow-diagram.md](../docs/telemetry-flow-diagram.md)
para el diagrama completo del flujo de telemetría.
