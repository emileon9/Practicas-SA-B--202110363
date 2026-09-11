# Auditoría contra la rúbrica — Práctica 7

Estado real al terminar la implementación (no aspiracional). Ver
[P7/README.md](../README.md) para el detalle de cada punto.

## HABILIDADES — 40%

| Criterio | Peso | Estado | Detalle |
|---|---|---|---|
| Documentación técnica | 10 | [✓] | [P7/README.md](../README.md) cubre objetivo, arquitectura, CI, CD, Docker, Kubernetes, secrets, ejecución local y problemas conocidos, todo con nombres reales del proyecto. |
| Diagrama del pipeline | 10 | [✓] | [docs/pipeline-diagram.md](pipeline-diagram.md), Mermaid versionado en Git, con los jobs y nombres reales de `ci.yml`/`cd.yml`. |
| Organización del repositorio | 5 | [✓] | `/P7` con `README.md`, `docs/`, `helm/`; workflows en `.github/workflows/`; no se duplicó código de P5, solo se referencia. |
| Preguntas teóricas | 15 | [✓] | [docs/preguntas-teoricas.md](preguntas-teoricas.md), 15 preguntas respondidas con referencias directas al código de este pipeline. |

## CONOCIMIENTO — 60%

| Criterio | Peso | Estado | Detalle |
|---|---|---|---|
| Pipeline CI/CD | 20 | [✓] | `ci.yml` (checkout → install → build → test → docker build) validado localmente: los 3 servicios Node y los 2 Python pasan `build`/`test` reales (ver README, sección Validación local). `cd.yml` fue validado con `helm template` (73 recursos renderizados sin error) pero el `helm upgrade` real contra un clúster **no se ha ejecutado** porque depende de que se registre el runner self-hosted (ver Pendientes). |
| Automatización Docker | 15 | [✓] | Las 7 imágenes reales del proyecto se construyen automáticamente en cada push/PR (`docker-validate`) y se publican con tag de commit + `latest` en GHCR en cada push a `master` (`docker-build-push`). Dockerfiles reutilizados sin modificar. |
| Deploy automático | 15 | [!] | El workflow de deploy (`cd.yml`) está completo, usa `helm upgrade --install` con las imágenes recién publicadas y verifica con `kubectl rollout status`, respetando la convención "solo Helm, nunca `kubectl apply -f`" del proyecto. Queda en **[!] parcial** porque no se ha ejecutado un rollout real todavía: requiere que el usuario registre el self-hosted runner y tenga un clúster local encendido (ver Pendientes) — limitación de infraestructura, no del workflow. |
| Versionamiento | 10 | [✓] | Estrategia explícita: PR → solo CI; push a `master` → CI + Docker Build + Push + Deploy; tags de imagen = SHA del commit + `latest` (no solo `latest`), lo que permite rollback trazable con `helm rollback`. |

## Requisitos adicionales del enunciado

| Requisito | Estado | Detalle |
|---|---|---|
| Usa el sistema de microservicios de P5/P6 | [✓] | Ningún microservicio, Dockerfile ni chart de Helm fue reinventado; `ci.yml`/`cd.yml` operan directamente sobre `P5/services`, `P5/jobs` y `P5/charts/sa-platform`. |
| Dockerización automática | [✓] | 7/7 imágenes reales construidas por el pipeline. |
| Pipeline funcional | [!] | CI 100% funcional y verificado localmente. CD funcional en su lógica (verificado con `helm template`) pero pendiente de una ejecución real end-to-end contra un clúster vivo. |
| Documentación obligatoria | [✓] | README + 4 documentos en `docs/`. |

## Qué falta para el máximo puntaje

1. **Ejecutar el CD real al menos una vez**: registrar el runner
   self-hosted, encender el clúster local (Docker Desktop Kubernetes o
   minikube), configurar la variable `SA_PLATFORM_SECRETS_PATH`, hacer un
   push a `master` y capturar las evidencias de
   [docs/evidencias.md](evidencias.md). Sin esto, "Deploy automático" y
   "Pipeline funcional" no pueden subir de `[!]` a `[✓]` porque la regla 11
   del enunciado prohíbe marcar como completo algo no validado.
2. Habilitar en el repositorio *Settings → Actions → General → Workflow
   permissions → Read and write permissions* (requerido para que
   `docker-build-push` pueda escribir en GHCR) — ver
   [P7/README.md](../README.md#secrets-y-configuración-requerida).
