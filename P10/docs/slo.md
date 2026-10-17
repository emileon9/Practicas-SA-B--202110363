# SLO declarados — sa-platform (Práctica 10)

## SLO 1 — Disponibilidad del gateway

| Campo | Valor |
|---|---|
| **SLI** | Proporción de peticiones a `/api/*` en el gateway que NO responden `5xx`, sobre el total |
| **Objetivo** | **99%** |
| **Ventana de medición** | 30 días (rolling) |
| **Regla de registro** | `slo:gateway_availability_ratio:rate1h` (ver [P10/observability/kube-prometheus-stack/values.yaml](../observability/kube-prometheus-stack/values.yaml), `additionalPrometheusRulesMap`) |
| **Presupuesto de error** | `slo:gateway_availability_error_budget_remaining:ratio30d` |

**Justificación del 99%:** el gateway es el único punto de entrada externo
del sistema (todo el tráfico pasa por él — ver
[P8/docs/gitops-flow.md](../../P8/docs/gitops-flow.md)); perder
disponibilidad ahí bloquea el 100% de los usuarios, no un subconjunto.
Al mismo tiempo, el clúster de destino real es de un solo nodo
(`docker-desktop`), sin redundancia multi-zona ni multi-región: comprometerse
a 99.9% o más sería un objetivo que la infraestructura actual no puede
sostener de forma realista (una sola reinicialización del nodo ya
consumiría una fracción significativa de ese presupuesto). 99% permite
~7.2 horas de indisponibilidad acumulada al mes — razonable para un
proyecto académico de un solo nodo sin alta disponibilidad real, sin ser
tan laxo que la alerta de presupuesto de error nunca dispare.

## SLO 2 — Latencia del gateway

| Campo | Valor |
|---|---|
| **SLI** | Proporción de peticiones a `/api/*` que responden en ≤1 segundo, sobre el total |
| **Objetivo** | **95%** |
| **Ventana de medición** | 7 días (se usan ventanas de 5m/1h para las reglas de alerta por presupuesto, ver [alerts.md](alerts.md)) |
| **Regla de registro** | `slo:gateway_latency_ratio:rate5m` / `:rate1h` |

**Justificación del umbral de 1s / 95%:** no es un número arbitrario —
coincide exactamente con el umbral que ya usaba el canario de la
Práctica 8 (`maxLatencySeconds: 1`, ver
[P8/helm/gateway/values.yaml](../../P8/helm/gateway/values.yaml)) y con
el umbral `p(95)<1500ms` que ya validó la prueba de carga de P8
([P8/tests/load/results/summary.json](../../P8/tests/load/results/summary.json),
resultado real: p95 100.67ms, muy por debajo del umbral). Fijar el SLO en
el mismo valor que el sistema ya demostró cumplir con margen evita un
objetivo "de cara a la galería" sin relación con el comportamiento real
medido.

## Limitaciones declaradas honestamente

- Las reglas de alerta implementadas usan **una sola ventana rápida**
  (5m) y una ventana lenta (1h) por SLO, no el patrón completo de
  "multi-window, multi-burn-rate" de 4 ventanas que recomienda el SRE
  Workbook de Google (sería lo ideal en producción real, pero excede el
  alcance de tiempo de esta entrega). Esto puede producir algún falso
  positivo en ráfagas cortas de tráfico bajo — mitigado parcialmente con
  la condición `requests_total > 0` y `isNaN()` en el AnalysisTemplate
  del canario (ver
  [P8/helm/gateway/templates/analysistemplate.yaml](../../P8/helm/gateway/templates/analysistemplate.yaml)).
- La ventana de 30 días del SLO 1 requiere que Prometheus retenga datos
  ese tiempo; el `values.yaml` actual fija `retention: 3d` (clúster local
  de prueba, sin backend remoto de métricas) — el presupuesto de error de
  30 días es la fórmula correcta, pero no tendrá 30 días reales de datos
  hasta que el sistema lleve ese tiempo corriendo de forma continua. Esto
  se declara aquí explícitamente, no se oculta.

## Estado de medición real

PENDIENTE — ningún valor de estas tablas se ha medido todavía contra el
clúster real (el stack de observabilidad no se ha desplegado). Ver
[P10/docs/operation-report.md](operation-report.md).
