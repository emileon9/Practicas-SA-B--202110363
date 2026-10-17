# Informe de operación — sa-platform (Práctica 10)

> Extensión máxima de dos páginas, seis campos exigidos. Los valores
> marcados `PENDIENTE` se completan con datos reales después de ejecutar
> el procedimiento de [runbook.md, secciones 6-8](runbook.md#6-prueba-obligatoria-6-y-7--fallo-inducido--reversión-automática-por-prometheus) —
> no se inventan tiempos ni resultados antes de medirlos (mismo valor de
> "honestidad técnica" ya aplicado en
> [P9/docs/dr-report.md](../../P9/docs/dr-report.md)).

## 1. SLO declarados: objetivo, ventana y justificación

- **SLO 1 (disponibilidad):** 99% de peticiones `/api/*` sin `5xx`,
  ventana de 30 días. Justificación: único punto de entrada externo, sin
  redundancia multi-nodo real en el clúster de destino. Detalle completo:
  [slo.md](slo.md).
- **SLO 2 (latencia):** 95% de peticiones `/api/*` en ≤1s, ventana de 7
  días (reglas de alerta en 5m/1h). Justificación: mismo umbral que ya
  usaba el canario de P8 y que la prueba de carga de P8 demostró cumplir
  con margen amplio (p95 real: 100.67ms).

## 2. Fallo inducido: qué se rompió y cómo se provocó

Distinto del fallo de P8 (que rompía `/health` con una probabilidad de
HTTP 500): este inyecta **latencia** en el tráfico real proxied por el
gateway (`/api/*`), vía las variables `FAULT_INJECT_LATENCY_RATE` /
`FAULT_INJECT_LATENCY_MS` (ver
[P5/services/gateway/src/app.ts](../../P5/services/gateway/src/app.ts) y
[P8/helm/gateway/values.yaml](../../P8/helm/gateway/values.yaml)). A
diferencia de P8, el `AnalysisTemplate` del canario ya no genera su
propio tráfico sintético (provider `job`): consulta métricas reales
(provider `prometheus`) del tráfico que efectivamente llega al Pod
candidato durante el rollout — requiere tráfico real sostenido (k6)
corriendo en paralelo.

## 3. Tiempo de detección: tiempo medido y marcas de tiempo

PENDIENTE DE PRUEBA — `t1 - t0`, ver
[runbook.md, sección 8](runbook.md#8-prueba-obligatoria-9--medir-tiempos-detección-causa-recuperación)
para la definición exacta de cada marca de tiempo.

## 4. Recorrido hasta la causa: pasos seguidos y duración

PENDIENTE DE PRUEBA — `t2 - t1`. Procedimiento preparado y documentado en
[telemetry-flow-diagram.md](telemetry-flow-diagram.md), sección
"Recorrido síntoma → causa": dashboard → Tempo → traza → log JSON por
`trace_id`.

## 5. Tiempo de recuperación: duración y quién/qué resolvió el problema

PENDIENTE DE PRUEBA — `t3 - t0`. Se espera que la recuperación sea
**automática** (Argo Rollouts revierte el peso a 0% del canario al fallar
el `AnalysisRun`), no una intervención manual — eso es justamente lo que
esta prueba busca demostrar. Si la recuperación real termina siendo
manual, se documentará aquí honestamente, junto con la razón (ver el
valor formativo "honestidad técnica" del enunciado).

## 6. Alerta faltante o sobrante: mejoras identificadas

PENDIENTE DE PRUEBA — se completará después de ejecutar el escenario
real. Candidato ya identificado por inspección (a confirmar o descartar
con la prueba real): las 4 alertas actuales cubren disponibilidad,
latencia y ausencia total de tráfico, pero ninguna cubre específicamente
"el canario quedó pausado/abortado y nadie lo promovió ni revirtió
manualmente" — un estado intermedio que Argo Rollouts puede dejar
indefinidamente si el `AnalysisRun` entra en `Error` (no `Failed`) por un
problema de infraestructura (p. ej. Prometheus no disponible) en vez de
por una métrica real.

---

*Preparado antes de la ejecución real, como parte de la entrega
versionada de la Práctica 10. Ver [P10/README.md](../README.md) para el
estado completo de lo implementado vs. lo pendiente de probar.*
