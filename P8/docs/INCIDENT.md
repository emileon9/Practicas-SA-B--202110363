# Informe de incidente — fallo inducido en el canary de `gateway`

> Plantilla lista para completarse con datos reales de la demostración.
> Los mecanismos descritos abajo (qué se rompe, qué lo detecta, cómo se
> revierte) ya están implementados y son reales; los números marcados
> `PENDIENTE` se llenan al ejecutar la demo contra un clúster real — no se
> inventan aquí.

## Qué falló

Se publicó deliberadamente una versión defectuosa de `gateway`
(`vX.Y.Z-fault`, PENDIENTE del tag real usado en la demo) con la variable
de entorno `FAULT_INJECT_RATE` elevada (por ejemplo a `0.5`) en el overlay
`values-prod.yaml` del repositorio GitOps para ese release. Con
`FAULT_INJECT_RATE > 0`, el endpoint `GET /health` de gateway
(`P5/services/gateway/src/app.ts`) responde `HTTP 500` con esa
probabilidad en cada llamada, en vez de `200 {"status":"ok",...}`. Es el
único cambio de código entre la versión estable y la defectuosa: ningún
otro comportamiento de la plataforma se modifica.

## Cómo se detectó

El `AnalysisTemplate` `gateway-canary-analysis`
(`P8/helm/gateway/templates/analysistemplate.yaml`), ejecutado
automáticamente por Argo Rollouts en el primer paso del canary (10% de
tráfico hacia la versión nueva), realiza 20 peticiones a `/health` y
calcula la tasa de error. El umbral configurado es
`canary.analysis.maxErrorRatePercent: 10` (ver
`P8/helm/gateway/values.yaml`). Con `FAULT_INJECT_RATE=0.5`, la tasa de
error observada (≈50%, moderada por el hecho de que el Service también
enruta tráfico hacia los pods estables sin el defecto) supera ese 10%, y
el Job del `AnalysisTemplate` termina con `exit 1`.

- Métrica: tasa de error de `/health` sobre el Service de `gateway`.
- Threshold configurado: `10%`.
- Valor observado en la demo: `PENDIENTE` (capturar del log del Job de
  `AnalysisRun`, `kubectl logs -n sa-p5 job/<analysisrun-job>`).

## Cómo se contuvo

Argo Rollouts marca el `AnalysisRun` como `Failed` y, por configuración
por defecto de un `Rollout` con `strategy.canary` (sin
`spec.strategy.canary.analysis.templates` marcado como no-abortante), **el
Rollout aborta automáticamente y revierte el peso de tráfico al 100% de la
versión estable** — sin ejecutar `kubectl argo rollouts undo` ni ninguna
otra acción manual. El ReplicaSet de la versión defectuosa se escala a 0.

- Mecanismo de rollback: automático, disparado por `AnalysisRun` fallido
  en el primer step del canary (ver `P8/helm/gateway/templates/rollout.yaml`).
- Versión afectada: `PENDIENTE` (el tag defectuoso real usado en la demo).
- Porcentaje de tráfico afectado: máximo `10%` (el canary nunca superó el
  primer step, `setWeight: 10`).

## Tiempo de recuperación

`PENDIENTE` — medir, en la demo real, los minutos entre el momento en que
el `Rollout` inicia el canary de la versión defectuosa
(`kubectl get rollout gateway -n sa-p5 -w`, timestamp del evento
`RolloutStepCompleted`/inicio del primer `setWeight`) y el momento en que
`kubectl get rollout gateway -n sa-p5` vuelve a reportar
`Status: Healthy` con el 100% del tráfico en la versión estable. Dado que
el `AnalysisTemplate` corre 20 peticiones secuenciales con un timeout de
1s cada una (peor caso ~20s) más el tiempo de arranque del Job
(`activeDeadlineSeconds: 120`), el límite superior teórico de detección es
de unos 2-3 minutos; el número real debe capturarse de la demo, no
asumirse.

## Cómo prevenirlo

Un control adicional que habría evitado que esta versión llegara siquiera
al canary: ejecutar el **smoke test** (`P8/tests/smoke/smoke-test.sh`)
como parte de `gitops-update.yml`, contra un entorno de staging efímero,
**antes** de abrir el Pull Request al repositorio GitOps — actualmente el
pipeline solo corre tests unitarios, `helm lint`, Trivy y la firma, pero
no un smoke test end-to-end del propio release candidato. Con
`FAULT_INJECT_RATE` fijado explícitamente en cada overlay de ambiente (no
solo en el `values.yaml` base), un smoke test con ~20 peticiones a
`/health` ya habría detectado una tasa de error del 50% y bloqueado el
release antes de que el Pull Request se abriera, en vez de dejar que el
canary en producción fuera la primera línea de defensa.
