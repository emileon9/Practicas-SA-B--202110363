# Load tests — reutiliza el script de P5 (k6)

P8 reutiliza directamente
[P5/scripts/load-test/k6-script.js](../../../P5/scripts/load-test/k6-script.js),
en vez de crear un script casi idéntico dentro de `P8/`. Ya:

- usa k6 (instalado y verificado en esta máquina, v2.2.0);
- golpea los endpoints reales del gateway en round-robin (`/health`,
  `/api/users/health`, `/api/products/health`, `/api/orders/orders`,
  `/api/notifications/notifications`);
- define umbrales reales (no triviales, ver justificación abajo):
  `http_req_failed rate < 5%`, `http_req_duration p(95) < 1500ms`;
- produce un resumen reproducible (`scripts/load-test/results/summary.json`).

## Cómo correrlo

```bash
BASE_URL=http://sa-platform.local k6 run P5/scripts/load-test/k6-script.js
```

## Justificación de los umbrales (ligados a la promoción/reversión del Rollout)

| Umbral | Valor | Por qué |
|---|---|---|
| Tasa de error máxima | 5% (`http_req_failed rate<0.05`) | Más estricto que el 10% del `AnalysisTemplate` del canary (`P8/helm/gateway/templates/analysistemplate.yaml`) a propósito: el load test es una validación previa a publicar el release (con más volumen y duración), el `AnalysisTemplate` es el gate rápido que corre en vivo durante cada paso del canary. Un release que no pasa el 5% aquí no debería siquiera iniciar el canary. |
| Latencia p95 máxima | 1500 ms | Mismo orden de magnitud que el límite por-petición del canario (1s por petición individual); 1.5s de p95 bajo carga sostenida (80 VUs) es razonable para un proxy Express + microservicios en memoria sin cache, sin ser tan laxo que oculte una regresión real |
| Duración / usuarios virtuales | Rampa 0→20→80 VUs en 7 minutos totales (ver `options.scenarios` en el script) | Pensado explícitamente para forzar el HPA de `gateway` (min 2 / max 5 réplicas @ 70% CPU) y comprobar que también baja al cesar la carga — no es una carga arbitraria, está dimensionada contra los valores reales de `P8/helm/gateway/values.yaml` |

## Relación con el Rollout

Este load test **no** es uno de los pasos automáticos del canary (esos
usan el `AnalysisTemplate`, mucho más rápido: ~20 requests por paso, ver
`P8/docs/GITOPS.md`). Es la prueba de carga previa que se corre contra un
release candidato antes de crear el tag de Git que dispara
`gitops-update.yml` — exactamente el mismo rol que ya tenía en P5.
