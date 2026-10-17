# Alertas operativas — sa-platform (Práctica 10)

Las 4 reglas viven en
[P10/observability/kube-prometheus-stack/values.yaml](../observability/kube-prometheus-stack/values.yaml)
(`additionalPrometheusRulesMap.sa-platform-slo-rules`, grupo
`sa-platform-slo-alerts`). Ninguna es un umbral instantáneo de CPU/memoria
sin contexto — las 3 primeras están atadas al consumo del presupuesto de
error de un SLO declarado (ver [slo.md](slo.md)).

## `GatewayErrorBudgetBurnRateFast`

| Campo | Detalle |
|---|---|
| **Condición** | Disponibilidad real (5m) cae por debajo del umbral que agotaría el presupuesto de 30 días en <24h (multiplicador 14.4×, el estándar del SRE Workbook de Google para "fast burn") |
| **Severidad** | `critical` |
| **Por qué requiere intervención humana** | A ese ritmo, el SLO mensual se incumple en horas, no en días — no da tiempo a que un proceso automático (como el rollback del canario) sea suficiente si la causa está fuera del rollout en curso (p. ej. un servicio dependiente caído) |
| **Runbook** | [runbook.md#alerta-gatewayerrorbudgetburnratefast](runbook.md#alerta-gatewayerrorbudgetburnratefast) |
| **Acción propuesta** | Revisar el dashboard (panel "Errores"), identificar la ruta/servicio que falla, decidir entre rollback manual del Rollout o mitigación del servicio dependiente |

## `GatewayErrorBudgetBurnRateSlow`

| Campo | Detalle |
|---|---|
| **Condición** | Disponibilidad real (1h) por debajo del umbral "slow burn" (multiplicador 6×) sostenido 15 minutos |
| **Severidad** | `warning` |
| **Por qué requiere intervención humana** | Degradación sostenida que no es automáticamente reversible por el canario (no está necesariamente ligada a un rollout en curso) — alguien debe investigar antes de que escale a `critical` |
| **Runbook** | [runbook.md#alerta-gatewayerrorbudgetburnrateslow](runbook.md#alerta-gatewayerrorbudgetburnrateslow) |
| **Acción propuesta** | Revisar tendencia en el panel de disponibilidad; si continúa subiendo, tratar como incidente |

## `GatewayLatencySLOBurnRate`

| Campo | Detalle |
|---|---|
| **Condición** | Menos del 90% de las peticiones recientes responden en ≤1s (el SLO exige 95%) |
| **Severidad** | `warning` |
| **Por qué requiere intervención humana** | La causa puede ser saturación de recursos, un backend lento, o el fallo de latencia inducido deliberadamente (`FAULT_INJECT_LATENCY_RATE`) — distinguir cuál requiere revisar trazas en Tempo, no es automatizable con una sola métrica |
| **Runbook** | [runbook.md#alerta-gatewaylatencysloburnrate](runbook.md#alerta-gatewaylatencysloburnrate) |
| **Acción propuesta** | Buscar en Tempo una traza reciente del gateway con duración alta, seguir el `trace_id` hasta el log JSON correspondiente (ver [telemetry-flow-diagram.md](telemetry-flow-diagram.md)) |

## `GatewayNoTraffic`

| Campo | Detalle |
|---|---|
| **Condición** | Cero peticiones a `/api/*` durante 10 minutos |
| **Severidad** | `warning` |
| **Por qué requiere intervención humana** | Sin tráfico no hay señal para NINGUNA otra alerta de esta lista — un silencio total es en sí mismo un síntoma (Ingress caído, DNS roto, o el propio gateway sin Pods `Ready`), no ausencia de problema |
| **Runbook** | [runbook.md#alerta-gatewaynotraffic](runbook.md#alerta-gatewaynotraffic) |
| **Acción propuesta** | `kubectl get pods -n sa-p5 -l app=gateway`; si hay Pods `Ready`, revisar el Ingress y DNS antes de asumir que "no hay incidente" |

## Por qué no hay más alertas

Se evitó agregar alertas de CPU/memoria por umbral fijo sin justificación
("CPU > 80%") a propósito — el enunciado de la práctica las excluye
explícitamente ("evita alertas redundantes o que no requieran ninguna
acción"). La saturación de recursos sí está visible en el dashboard
(panel 4, [gateway-golden-signals.json](../dashboards/gateway-golden-signals.json))
para diagnóstico, pero no dispara una alerta por sí sola: un pico de CPU
sin impacto en disponibilidad o latencia reales no exige intervención.

## Estado real

PENDIENTE — ninguna alerta se ha disparado ni verificado todavía contra
el clúster real; el receiver `critical-alerts` de Alertmanager no tiene
un webhook real configurado (ver
[P10/observability/kube-prometheus-stack/values.yaml](../observability/kube-prometheus-stack/values.yaml),
sección `alertmanager.config`). Ver
[P10/docs/operation-report.md](operation-report.md) para el estado de la
prueba de fallo inducido.
