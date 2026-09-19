# Informe de incidente — fallo inducido en el canary de `gateway`

**Fecha:** 2026-09-19 · **Clúster:** `docker-desktop` · **Namespace:** `sa-p5`
**Versión estable:** `v1.0.0` · **Versión defectuosa:** `v1.1.0`

Todos los datos de este informe provienen de una ejecución real. Los
comandos que los produjeron están citados en cada sección.

## Qué falló

Se publicó deliberadamente `v1.1.0` de `gateway` con el defecto activado:
la variable de entorno `FAULT_INJECT_RATE` pasó de `0` a `0.5`, lo que hace
que el endpoint `GET /health` responda `HTTP 500` en aproximadamente la
mitad de las peticiones
(ver [P5/services/gateway/src/app.ts](../../P5/services/gateway/src/app.ts)).
Es el único cambio entre la versión estable y la defectuosa: ningún otro
comportamiento de la plataforma se modificó.

La versión defectuosa se publicó por el mismo camino que cualquier otra:
tag de Git `v1.1.0` → pipeline (`gitops-update.yml`) → ArgoCD → Argo
Rollouts. No se aplicó nada a mano contra el clúster.

## Cómo se detectó

El `AnalysisTemplate` `gateway-canary-analysis`, que Argo Rollouts ejecuta
en la primera compuerta del canary (10% del tráfico), lanzó un Job que hizo
20 peticiones reales a `/health` y midió la tasa de error.

Salida literal del Job (`kubectl logs -n sa-p5 -l job-name=...health-check.1`):

```
url=http://gateway.sa-p5.svc.cluster.local:4000/health requests=20 errors=4 error_rate=20% max_allowed=10% max_latency_s=1
FAIL: tasa de error 20% supera el umbral 10%
```

- **Validación:** `AnalysisRun gateway-68766c6b6f-3-1`, métrica `health-check`
- **Métrica:** tasa de error sobre `GET /health`
- **Threshold configurado:** 10% (`canary.analysis.maxErrorRatePercent`)
- **Valor observado:** **20%** (4 errores de 20 peticiones)

Sobre por qué se midió 20% y no ~50%: el canary es "básico", sin service
mesh, así que el Service reparte tráfico entre los pods estables y el
canary en proporción a sus réplicas. Solo una fracción de las peticiones
llegó al pod defectuoso, y de esas falló la mitad. Es exactamente la
limitación documentada en [GITOPS.md](GITOPS.md) — y esta medición la
confirma empíricamente. El umbral de 10% es lo bastante estricto para
detectar el defecto aun diluido de esa forma.

## Cómo se contuvo

Argo Rollouts marcó el `AnalysisRun` como `Failed` y abortó el rollout por
sí solo. Mensaje literal del Rollout:

```
RolloutAborted: Rollout aborted update to revision 3: Step-based analysis
phase error/failed: Metric "health-check" assessed Failed due to failed (1)
> failureLimit (0)
```

- **Mecanismo de rollback:** automático, sin intervención humana. No se
  ejecutó ningún `undo`, `promote` ni comando manual.
- **Versión afectada:** `v1.1.0` (revisión 3 del Rollout).
- **Porcentaje de tráfico afectado:** máximo **10%** — el canary nunca
  pasó del primer paso (`setWeight: 10`). El rollout quedó en `Step 0/7`,
  `ActualWeight: 0`, y el ReplicaSet defectuoso se escaló a 0.
- **Estado final:** `ghcr.io/emileon9/sa-platform/gateway:v1.0.0 (stable)`,
  2/2 réplicas disponibles durante todo el incidente.

## Tiempo de recuperación

| Momento | Hora (UTC) |
|---|---|
| Publicación de la versión defectuosa (push del tag `v1.1.0`) | 07:56:17 |
| Inicio del análisis en la primera compuerta | 07:56:54 |
| Análisis fallido / rollout abortado | 07:57:07 |
| Retorno confirmado al estado estable | 07:57:12 |

**Tiempo total de recuperación: 55 segundos** (13 de ellos fueron el
análisis en sí). En ningún momento el servicio dejó de atender: las dos
réplicas estables siguieron disponibles mientras el canary se evaluaba y
se retiraba.

## Cómo prevenirlo

El control que habría evitado que esta versión llegara al canary es
ejecutar el **smoke test** ([../tests/smoke/smoke-test.sh](../tests/smoke/smoke-test.sh))
contra un entorno de staging dentro de `gitops-update.yml`, **antes** de
abrir el Pull Request al repositorio GitOps. Hoy el pipeline corre pruebas
unitarias, `helm lint`, Trivy y la firma, pero ninguna prueba end-to-end
del release candidato: con 20 peticiones a `/health` habría detectado el
50% de error y bloqueado el release, en vez de dejar que el canary en
producción fuera la primera línea de defensa.

Un segundo control, más barato: validar en el pipeline que
`FAULT_INJECT_RATE` sea `0` en los values de cualquier ambiente que no sea
de pruebas. El defecto de este incidente era precisamente una variable de
configuración que nunca debió llegar a producción con ese valor.

