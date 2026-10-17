# Runbook de observabilidad y operación — sa-platform (Práctica 10)

Escrito para que alguien sin conocimiento previo del sistema pueda
verificar el stack y ejecutar las pruebas obligatorias de la práctica,
sin acceso al autor.

## 0. Prerrequisitos

| Herramienta | Verificar con |
|---|---|
| `kubectl` | `kubectl version --client` |
| `helm` | `helm version` |
| Clúster con P8 ya desplegado y sincronizado | `kubectl get application -n argocd` |
| `AppProject sa-platform` con el whitelist de Práctica 10 ya aplicado | `kubectl get appproject sa-platform -n argocd -o yaml \| grep -A2 ServiceMonitor` |

## 1. Desplegar el stack de observabilidad

```bash
kubectl apply -f P10/argocd/project/sa-observability-project.yaml
kubectl apply -f P10/argocd/applications/root.yaml
```

Verificar que las 6 Applications queden `Synced` + `Healthy`:

```bash
kubectl get application -n argocd -l app.kubernetes.io/part-of=sa-observability
```

## 2. Prueba obligatoria 1 — Prometheus recolecta métricas reales

```bash
kubectl port-forward svc/kube-prometheus-stack-prometheus -n observability 9090:9090
# En el navegador: http://localhost:9090/targets
# Verificar que gateway, ms-orders y ms-users aparezcan "UP"
```

Si algún target aparece `DOWN` con error de conexión, revisar primero la
`NetworkPolicy` (ver `P8/helm/platform/templates/networkpolicy.yaml`,
reglas agregadas en Práctica 10 para el namespace `observability`).

## 3. Prueba obligatoria 2 y 3 — traza de 3 servicios + correlación log↔traza

```bash
# Genera una peticion real que atraviesa gateway -> ms-orders -> ms-users
curl http://<host-del-gateway>/api/orders/orders
```

```bash
kubectl port-forward svc/grafana -n observability 3000:80
# Grafana -> Explore -> datasource Tempo -> buscar por servicio "gateway"
# Abrir la traza mas reciente: debe mostrar 3 spans (gateway, ms-orders, ms-users)
```

Desde esa traza, botón "Logs for this span" → debe llevar al log JSON en
Loki con el mismo `trace_id`. En sentido inverso: en Loki, buscar
`{service="ms-orders"} | json` y usar el `trace_id` de cualquier línea
para saltar de vuelta a Tempo (ver
[telemetry-flow-diagram.md](telemetry-flow-diagram.md)).

## 4. Prueba obligatoria 4 — métricas de negocio

```promql
sa_users_catalog_size
sum(rate(sa_orders_viewed_total[15m])) by (status)
```

Correr en Grafana Explore (datasource Prometheus) o en
`http://localhost:9090/graph`.

## 5. Prueba obligatoria 5 — SLO y presupuesto de error se calculan

```promql
slo:gateway_availability_ratio:rate1h
slo:gateway_availability_error_budget_remaining:ratio30d
slo:gateway_latency_ratio:rate5m
```

Deben devolver un valor numérico (no vacío, no error) — ver
[slo.md](slo.md) para la fórmula completa de cada uno.

## 6. Prueba obligatoria 6 y 7 — fallo inducido + reversión automática por Prometheus

Procedimiento completo (distinto del fallo de P8, que rompía `/health`):

```bash
# 1. Generar trafico real sostenido durante el rollout (el provider
#    "prometheus" del AnalysisTemplate NO genera su propio trafico, a
#    diferencia del provider "job" de P8 -- necesita trafico real).
k6 run P5/scripts/load-test/k6-script.js &  # reutiliza el script ya existente de P5

# 2. Publicar un release con el fallo de latencia activado SOLO en el
#    overlay de ambiente (igual que P8 activo FAULT_INJECT_RATE):
#    FAULT_INJECT_LATENCY_RATE=0.5, FAULT_INJECT_LATENCY_MS=2000
#    (ver P8/helm/gateway/values.yaml para los nombres exactos)

# 3. Observar el Rollout
kubectl argo rollouts get rollout gateway -n sa-p5 --watch
```

Esperado: en el primer paso (10%), el `AnalysisRun` del paso consulta
`error-rate`/`p95-latency` vía PromQL contra el Pod candidato
(filtrado por `pod_template_hash`, ver
[P8/helm/gateway/templates/analysistemplate.yaml](../../P8/helm/gateway/templates/analysistemplate.yaml)),
detecta la latencia inducida, y Argo Rollouts revierte automáticamente al
100% de la versión estable.

## 7. Prueba obligatoria 8 — registrar el AnalysisRun que provoca la reversión

```bash
kubectl get analysisrun -n sa-p5 -l rollouts-pod-template-hash
kubectl describe analysisrun <nombre-del-analysisrun-fallido> -n sa-p5
```

Guardar la salida en `P10/evidence/analysisrun-<fecha>.txt`.

## 8. Prueba obligatoria 9 — medir tiempos (detección, causa, recuperación)

Marcas de tiempo a registrar (ver plantilla en
[operation-report.md](operation-report.md)):

- `t0`: momento en que se publica el release con el fallo inducido.
- `t1`: momento en que `GatewayLatencySLOBurnRate` pasa a estado `Firing`
  (`kubectl get prometheusrule -n observability`, o la UI de
  Alertmanager vía `kubectl port-forward svc/kube-prometheus-stack-alertmanager -n observability 9093:9093`).
- `t2`: momento en que, siguiendo el runbook de la sección 3 de este
  documento, se identifica la traza/log que explica la causa.
- `t3`: momento en que el `Rollout` vuelve a `Healthy` al 100% estable
  (`kubectl get rollout gateway -n sa-p5`).

Tiempo de detección = `t1 - t0`. Recorrido a la causa = `t2 - t1`.
Recuperación = `t3 - t0`.

## 9. Prueba obligatoria 10 — GitOps, admisión y cadena de suministro siguen funcionando

```bash
kubectl get application -n argocd  # las 9 de P8 + 6 de P10, todas Synced+Healthy
kubectl apply -n sa-p5 -f P8/security/kyverno/test-invalid-latest.yaml  # debe seguir siendo rechazado
bash P8/tests/smoke/smoke-test.sh
```

## Alertas — procedimiento por alerta

### Alerta `GatewayErrorBudgetBurnRateFast`
1. `kubectl port-forward svc/grafana -n observability 3000:80` → panel "Errores".
2. Identificar la ruta con mayor tasa de 5xx.
3. Si coincide con un Rollout en curso: `kubectl argo rollouts undo gateway -n sa-p5`.
4. Si no: revisar logs del servicio de destino en Loki filtrando por esa ruta.

### Alerta `GatewayErrorBudgetBurnRateSlow`
Igual que la anterior, sin la urgencia de abortar un rollout: documentar
como incidente de seguimiento si la tendencia no revierte en 30 minutos.

### Alerta `GatewayLatencySLOBurnRate`
1. Explore → Tempo → filtrar `gateway`, ordenar por duración descendente.
2. Seguir la traza más lenta hasta el log JSON correspondiente (sección 3).
3. Verificar si `FAULT_INJECT_LATENCY_RATE` está activo por error en el ambiente actual.

### Alerta `GatewayNoTraffic`
1. `kubectl get pods -n sa-p5 -l app=gateway`.
2. Si hay Pods `Ready`: `kubectl get ingress -n sa-p5` y verificar DNS/Ingress controller.
3. Si no hay Pods `Ready`: `kubectl describe pod` sobre el Pod con problemas.

## Problemas conocidos / troubleshooting

| Síntoma | Causa probable | Acción |
|---|---|---|
| Prometheus target `DOWN` para gateway/ms-orders/ms-users | NetworkPolicy no permite ingress desde `observability` | Verificar `P8/helm/platform/templates/networkpolicy.yaml` tiene la regla agregada en P10 |
| `AnalysisRun` siempre pasa aunque el fallo esté activo | No hay tráfico real durante el paso (el provider `prometheus` no genera tráfico propio) | Confirmar que k6 (o tráfico real) esté corriendo durante el rollout |
| `/orders` nunca incluye `userName` | NetworkPolicy bloquea ms-orders→ms-users, o `USERS_SERVICE_URL` mal configurado | `kubectl logs -n sa-p5 -l app=ms-orders \| grep "fallo al consultar ms-users"` |
| Dashboard no aparece en Grafana | Sidecar de dashboards no detectó el ConfigMap | Verificar label `grafana_dashboard: "1"` en `kubectl get configmap -n observability --show-labels` |
