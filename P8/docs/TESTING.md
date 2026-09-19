# Pruebas automatizadas — Práctica 8

Tres categorías, cada una contra endpoints reales del sistema (ninguna
métrica ni endpoint fue inventado; todos existen en
[P5/services](../../P5/services) y están documentados en
[P7/README.md sección 3](../../P7/README.md)).

## 1. Unit tests 

Ver [P7/README.md sección 6](../../P7/README.md#6-tests):
`P5/services/*/tests`, corridos por el job `test-node`/`test-python` de
`.github/workflows/ci.yml`. Se les agregó una prueba (indirecta) al añadir
el hook de fallo inducido: `P5/services/gateway/tests/gateway.test.ts`
sigue pasando sin cambios porque `FAULT_INJECT_RATE` por defecto es `0`
(verificado: `npm test` → 3/3 tests OK tras el cambio).

| Requisito | Archivo | Comando | Resultado esperado | Evidencia |
|---|---|---|---|---|
| Unit tests no rotos por el fallo inducido | `P5/services/gateway/tests/gateway.test.ts` | `cd P5/services/gateway && npm test` | `3 passed, 3 total` | Log de `npm test` (ya verificado en esta sesión) |

## 2. Smoke tests

**Archivo:** [P8/tests/smoke/smoke-test.sh](../tests/smoke/smoke-test.sh)

Valida los endpoints críticos reales: `GET /health` de cada uno de los 5
servicios REST, `GET /api/orders/orders`, `GET
/api/notifications/notifications`, y `POST /api/{users,products}/graphql`
(el único verbo POST real que expone la plataforma).

| Requisito | Comando | Resultado esperado | Evidencia |
|---|---|---|---|
| Endpoints críticos responden 200 | `BASE_URL=http://sa-platform.local bash P8/tests/smoke/smoke-test.sh` | `0 fallo(s)`, exit code 0 | Salida de consola del script, pendiente de ejecutar contra un deploy real (no hay clúster encendido ahora, ver README.md sección 4) |

## 3. Integration tests

**Archivo:** [P8/tests/integration/integration-test.sh](../tests/integration/integration-test.sh)

Dos pruebas reales de interacción entre componentes (no solo "responde
200" por separado):

1. **Gateway → ms-users**: confirma que el gateway reenvía de verdad la
   petición GraphQL (no una respuesta fabricada por el propio gateway) —
   ver `createServiceProxy` en
   `P5/services/gateway/src/services/proxy.service.ts`.
2. **API → PostgreSQL → RabbitMQ → ms-notifications**: dispara
   manualmente `cronjob-heartbeat` (escribe en PostgreSQL) y
   `cronjob-summary` (lee PostgreSQL, publica en RabbitMQ), y comprueba
   que `GET /api/notifications/notifications` refleja el resultado —
   la cadena asíncrona real documentada en
   [P5/docs/async-messaging.md](../../P5/docs/async-messaging.md).

| Requisito | Comando | Resultado esperado | Evidencia |
|---|---|---|---|
| Gateway reenvía correctamente | `bash P8/tests/integration/integration-test.sh` (test 1) | Respuesta con `__typename` presente | Salida de consola |
| Cadena DB→broker→consumidor funciona | mismo script (test 2) | `GET /notifications` refleja el nuevo resumen dentro de 30s | Salida de consola, pendiente de ejecutar contra un clúster real |

## 4. Load tests

Ver [P8/tests/load/README.md](../tests/load/README.md) — reutiliza
[P5/scripts/load-test/k6-script.js](../../P5/scripts/load-test/k6-script.js)
sin duplicarlo. Umbrales y su justificación documentados ahí.

## 5. Relación con el AnalysisTemplate del canary

El `AnalysisTemplate` de Argo Rollouts
(`P8/helm/gateway/templates/analysistemplate.yaml`) **no** ejecuta estos
scripts completos: corre una versión mínima y rápida (20 peticiones a
`/health`, ver `P8/docs/GITOPS.md`) apropiada para bloquear un paso de
canary en segundos, no en minutos. El smoke test, el integration test y el
load test de esta página son las validaciones "pesadas" que se corren
antes de taggear un release y, opcionalmente, de forma manual contra un
canario ya promovido a 100%.
