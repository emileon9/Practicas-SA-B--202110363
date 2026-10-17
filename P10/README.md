# Práctica 10 — Observabilidad y operación

Software Avanzado (USAC) · Carné **202110363**

## 1. Objetivo

Instrumentar 3 microservicios reales del ecosistema de la [Práctica 8](../P8)
con los tres pilares de observabilidad (métricas, trazas distribuidas,
logs estructurados), desplegar el stack que los recibe vía GitOps, hacer
que el canario de Argo Rollouts decida con métricas reales de Prometheus
(no con tráfico sintético, como en P8), y declarar + medir SLO reales con
su presupuesto de error.

## 2. Arquitectura general

```
cliente -> gateway -> ms-orders -> ms-users      (traza de 3 servicios reales)
              |            |           |
              v            v           v
         OTel Collector (OTLP) -> Tempo (trazas)
              |
    /metrics scrapeado por ServiceMonitor -> Prometheus -> Grafana
              |
    stdout JSON (trace_id) -> Promtail -> Loki -> Grafana

Argo Rollouts (AnalysisTemplate) -> PromQL -> Prometheus
  (decide promover/revertir el canario con métricas reales)
```

Diagrama completo del flujo de telemetría (enfocado en el recorrido
síntoma → causa, no en arquitectura general):
**[docs/telemetry-flow-diagram.md](docs/telemetry-flow-diagram.md)**.

## 3. Qué se está implementando

| Componente | Carpeta |
|---|---|
| Stack de observabilidad vía GitOps (Prometheus+Alertmanager+Grafana, Tempo, Loki+Promtail, OTel Collector) | [argocd/](argocd), [observability/](observability) |
| Instrumentación real de `gateway`, `ms-orders`, `ms-users` | `P5/services/{gateway,ms-orders,ms-users}/{src,app}/observability/` |
| Llamada real nueva `ms-orders → ms-users` (crea la traza de 3 servicios) | `P5/services/ms-orders/app/services/users_client.py` |
| `AnalysisTemplate` gobernado por PromQL + fallo inducido nuevo (latencia, no `/health`) | [P8/helm/gateway/templates/analysistemplate.yaml](../P8/helm/gateway/templates/analysistemplate.yaml) |
| SLO + presupuesto de error + alertas | [docs/slo.md](docs/slo.md), [docs/alerts.md](docs/alerts.md) |
| Dashboard de Grafana (4 señales de oro + SLO + métricas de negocio) | [dashboards/](dashboards) |
| Runbook, informe de operación, diagrama | [docs/](docs) |

## 4. Cómo se realiza la recuperación / operación

Ver **[docs/runbook.md](docs/runbook.md)** — 10 secciones, una por cada
prueba obligatoria de la sección 4 del enunciado, con comandos concretos.

## 5. Qué ya está implementado y verificado con ejecución real

- **`ms-orders`**: instrumentación completa (trazas OTel+FastAPI+httpx,
  métricas técnicas + de negocio, logs JSON con `trace_id`) y la llamada
  real a `ms-users`. **Verificado de verdad**: `pip install` + `pytest`
  reales, 4/4 tests pasan, incluida la degradación controlada cuando
  `ms-users` no responde.
- **`gateway` y `ms-users`**: instrumentación completa. **Verificado de
  verdad**: `npm install` + `npm run build` + `npm test` reales en ambos
  (3/3 y 3/3 tests pasan), incluida una corrección real de API
  (`resourceFromAttributes` no existe en la versión instalada de
  `@opentelemetry/resources`; se corrigió a `new Resource(...)`, la API
  real del paquete instalado). La query GraphQL nueva `user(id)` se
  probó end-to-end manualmente.
- **Wiring en los Helm charts de P8**: variables `OTEL_EXPORTER_OTLP_ENDPOINT`/`OTEL_SERVICE_NAME`/`IMAGE_TAG`,
  puerto `http` nombrado en los 3 Services, `ServiceMonitor` por
  servicio, y **dos `NetworkPolicy` nuevas** (sin las cuales Prometheus
  no podría scrapear `/metrics` ni `ms-orders` podría llegar a
  `ms-users` — bugs reales encontrados durante esta implementación, no
  hipotéticos). **Verificado**: `helm template` de los 4 charts tocados
  renderiza sin errores (`exit: 0`), incluida la corrección de un bug
  real de Helm (`{{args.canary-hash}}` escrito sin escapar dentro de un
  comentario rompía el parseo del template completo).
- **Stack de observabilidad**: AppProject + 6 Applications + `values.yaml`
  de cada componente, con `runAsNonRoot`/`resources`/tag explícito en
  todos lados (las 3 políticas de Kyverno de P8 aplican a todo el
  clúster, no solo a `sa-p5`).
- **SLO, presupuesto de error, 4 alertas, dashboard**: definidos como
  código (reglas de Prometheus + ConfigMap de Grafana), con YAML/JSON
  validado sintácticamente.

## 6. Qué está preparado pero pendiente de ejecución/pruebas

- El stack de observabilidad **no se ha desplegado** contra un clúster
  real todavía (versiones de los 4 charts de Helm dejadas `PENDIENTE` a
  propósito, sin verificar contra el repo real de charts).
- Ninguna de las 10 pruebas obligatorias de la sección 4 del enunciado se
  ha ejecutado contra un entorno real.
- El receiver `critical-alerts` de Alertmanager no tiene un webhook real
  configurado (nunca se versiona un token/URL real en git).
- `docs/operation-report.md`: los 6 campos están preparados, 4 de 6 con
  placeholders `PENDIENTE DE PRUEBA` explícitos.
- Video demostrativo.

## 7. Instrucciones iniciales de ejecución

```bash
kubectl apply -f P10/argocd/project/sa-observability-project.yaml
kubectl apply -f P10/argocd/applications/root.yaml
# Ver P10/docs/runbook.md para el resto (verificación, pruebas, fallo inducido)
```

## 8. Tabla de enlaces obligatoria

| Ítem | Enlace o dato requerido |
|---|---|
| URL pública del repositorio de código | https://github.com/emileon9/Practicas-SA-B--202110363 |
| URL pública del repositorio GitOps | https://github.com/emileon9/practica8-gitops |
| Tres servicios instrumentados y namespace | `gateway`, `ms-orders`, `ms-users` — namespace `sa-p5` |
| Nombre y ruta del `AnalysisTemplate` | `gateway-canary-analysis` — [P8/helm/gateway/templates/analysistemplate.yaml](../P8/helm/gateway/templates/analysistemplate.yaml) |
| Consultas PromQL utilizadas | Ver [P8/helm/gateway/templates/analysistemplate.yaml](../P8/helm/gateway/templates/analysistemplate.yaml) (error-rate, p95-latency) y [docs/slo.md](docs/slo.md) (reglas de registro) |
| SLO declarados y sus ventanas | Disponibilidad 99%/30d, Latencia 95% ≤1s/7d — [docs/slo.md](docs/slo.md) |
| Ruta de las reglas de alerta | [observability/kube-prometheus-stack/values.yaml](observability/kube-prometheus-stack/values.yaml) (`additionalPrometheusRulesMap`) |
| Ruta del dashboard JSON | [dashboards/gateway-golden-signals.json](dashboards/gateway-golden-signals.json) |
| Nombre del `AnalysisRun` fallido y del `Rollout` | **PENDIENTE** — se completa tras ejecutar `docs/runbook.md`, sección 6-7 |
| Ruta de la evidencia del recorrido de síntoma a causa y tiempo medido | **PENDIENTE** — se generará en `P10/evidence/` |
| URL del video y minutaje | **PENDIENTE** |

## 9. Verificación de limpieza del repositorio

```bash
git status --porcelain P10 P5/services/{gateway,ms-orders,ms-users} P8/helm/{gateway,ms-orders,ms-users,platform}
# Revisar que no haya credenciales, tokens, ni archivos *.env reales antes de git add
```
