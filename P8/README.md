# Práctica 8 — GitOps, entrega progresiva y seguridad de la cadena de suministro

Software Avanzado (USAC) · Carné **202110363**

> **Estado: en construcción.** Este README documenta primero el diagnóstico
> real del repositorio (Fase 1) y el plan de implementación. Las secciones
> marcadas `PENDIENTE` se completan en fases posteriores, a medida que se
> implementan y se pueden verificar (no se documenta nada que no se haya
> ejecutado o construido realmente).

## 0. Qué evoluciona respecto a P7

[P7](../P7) automatizó CI/CD con GitHub Actions, pero el job de despliegue
(`cd.yml`) ejecuta `helm upgrade --install` **directamente contra el clúster
local** desde un runner self-hosted. P8 elimina ese acoplamiento: GitHub
Actions deja de tocar el clúster; el repositorio Git (uno de aplicación y
uno de manifiestos GitOps) pasa a ser la única fuente de verdad, y ArgoCD +
Argo Rollouts son los únicos componentes que aplican cambios al clúster, con
entrega progresiva (canary) y reversión automática ante fallos.

## 1. Diagnóstico del repositorio existente (Fase 1)

### 1.1 Arquitectura actual

Un único chart de Helm (`sa-platform`, ver
[P5/charts/sa-platform](../P5/charts/sa-platform)) empaqueta **7 componentes
reales** en el namespace `sa-p5`, con dependencias externas `postgresql` y
`rabbitmq` (Bitnami) y una capa de red (`NetworkPolicy`) e infraestructura de
namespace (`ResourceQuota`, `LimitRange`) definida **dentro del propio
chart** (`P5/charts/sa-platform/values.yaml`).

### 1.2 Servicios existentes (reales, no inventados)

| Servicio | Stack | Dockerfile |
|---|---|---|
| `gateway` | Node 20 / TS / Express | [P5/services/gateway/Dockerfile](../P5/services/gateway/Dockerfile) |
| `ms-users` | Node 20 / TS / Express + GraphQL | [P5/services/ms-users/Dockerfile](../P5/services/ms-users/Dockerfile) |
| `ms-products` | Node 20 / TS / Express + GraphQL | [P5/services/ms-products/Dockerfile](../P5/services/ms-products/Dockerfile) |
| `ms-orders` | Python 3.12 / FastAPI | [P5/services/ms-orders/Dockerfile](../P5/services/ms-orders/Dockerfile) |
| `ms-notifications` | Python 3.12 / FastAPI + pika | [P5/services/ms-notifications/Dockerfile](../P5/services/ms-notifications/Dockerfile) |
| `cronjob-heartbeat` | Python | [P5/jobs/cronjob-heartbeat/Dockerfile](../P5/jobs/cronjob-heartbeat/Dockerfile) |
| `cronjob-summary` | Python | [P5/jobs/cronjob-summary/Dockerfile](../P5/jobs/cronjob-summary/Dockerfile) |

Todos exponen `GET /health` (usado como readiness/liveness probe desde P5),
lo que los hace aptos como base real para smoke tests y para las métricas
del `AnalysisTemplate` de Argo Rollouts (Fase 4).

### 1.3 CI/CD existente (P7)

- **CI** ([.github/workflows/ci.yml](../.github/workflows/ci.yml)): tests
  (Jest/pytest) + `docker build` de validación + `docker push` a GHCR
  (`ghcr.io/emileon9/sa-platform/<servicio>`) con tag `<sha>` **y
  `latest`** cuando el push es a `master`.
- **CD** ([.github/workflows/cd.yml](../.github/workflows/cd.yml)): se
  dispara por `workflow_run` tras un CI exitoso en `master` y ejecuta
  `helm upgrade --install` **directamente** en un runner self-hosted contra
  el clúster local (`docker-desktop`/`minikube`), porque el clúster GKE de
  P6 fue eliminado el 05/09/2026 por costo (ver
  [P6/docs/eliminacion.md](../P6/docs/eliminacion.md)).

### 1.4 Qué de esto es incompatible con P8 (y la corrección propuesta)

| Incompatibilidad detectada | Corrección propuesta para P8 |
|---|---|
| `cd.yml` ejecuta `helm upgrade --install` contra el clúster desde Actions | Eliminar el despliegue de `cd.yml`. El pipeline de código termina en: build → escaneo → firma → push → PR al repo GitOps. ArgoCD pasa a ser quien sincroniza. |
| Las imágenes se etiquetan también como `latest` | Dejar de publicar `latest`; usar únicamente tags semánticos derivados de tags de Git (`vX.Y.Z`), consistente con la convención de tag-por-commit que P7 ya usaba parcialmente. |
| `ResourceQuota`/`LimitRange`/namespace se crean **desde el chart de Helm** | Es el mismo tipo de solape que pide resolver la rúbrica de P8 (Terraform debe administrar namespace/quotas/RBAC). Se mueven esos recursos de *infraestructura de plataforma* a Terraform y se documentan como responsabilidad de Terraform; Helm conserva únicamente los `resources.requests/limits` **por contenedor** (configuración de la aplicación, no de la plataforma). |
| Un solo chart umbrella para 7 componentes, en vez de "un chart por microservicio" | **Aplicado.** Se fragmentó en 7 charts de Helm independientes (`P8/helm/<componente>`), cada uno con su `Chart.yaml`, `values.yaml`, `values-dev.yaml` y `values-prod.yaml` propios. Los recursos que antes compartían (ConfigMap, Secrets, Ingress, ResourceQuota/LimitRange) se resolvieron sin duplicarlos — ver el detalle en [docs/GITOPS.md, sección 4](docs/GITOPS.md#4-decisión-un-chart-de-helm-independiente-por-componente). |
| No existe repositorio GitOps independiente | Se prepara toda la estructura esperada (`argocd/`, convenciones de path/branch) dentro de este repo, documentando exactamente qué se debe crear manualmente como repo independiente en GitHub (Fase 3). |

### 1.5 Qué reutilizar sin cambios

- Los 7 Dockerfiles (multi-stage, `USER` no-root ya configurado).
- El chart `sa-platform` como base (valores por servicio, HPA, probes,
  NetworkPolicy).
- Los tests unitarios/integración de P7 (`P5/services/*/tests`) como base
  de los *integration tests* de P8.
- El script de carga existente ([P5/scripts/load-test/k6-script.js](../P5/scripts/load-test/k6-script.js))
  como punto de partida para los *load tests* de P8 (ya usa k6).
- GHCR como registro de contenedores.

### 1.6 Qué falta (a implementar en las fases siguientes)

Terraform (namespace/quotas/RBAC), repositorio/estructura GitOps, Application
de ArgoCD, Argo Rollouts (canary + `AnalysisTemplate`), smoke/integration
tests dedicados a P8, Trivy + SBOM + Cosign + verificación de firma en el
pipeline, políticas Kyverno, gestión de secretos sin texto plano, estrategia
de fallo inducido + rollback automático, informe de incidente, diagrama y
tabla de evidencias.

## 2. Plan de implementación por fases

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Diagnóstico (este documento) | ✅ |
| 2 | Estructura P8, Terraform, Helm (7 charts independientes), tests base, docs base | 🔄 en progreso — Terraform y los 7 charts listos y validados con `helm lint`/`helm template`; falta `terraform validate` real (Terraform no está instalado en esta máquina todavía) y los tests base |
| 3 | GitOps: manifiestos, ArgoCD Application, flujo de actualización de imagen | ⬜ pendiente |
| 4 | Argo Rollouts: canary de 3+ pasos, `AnalysisTemplate`, rollback automático | ⬜ pendiente |
| 5 | Seguridad de cadena de suministro: Trivy, SBOM, Cosign, Kyverno, secretos | ⬜ pendiente |
| 6 | Ejecución/validación real de lo anterior (`helm lint`, `terraform validate`, etc.) | ⬜ pendiente |
| 7 | Evidencia por requisito | ⬜ pendiente |
| 8 | Documentación final (`GITOPS.md`, `SECURITY.md`, `TESTING.md`, `INCIDENT.md`, tabla de enlaces) | ⬜ pendiente |

## 3. Estructura de archivos de esta práctica (parcial, se amplía por fase)

```
P8/
├── README.md              Este archivo (diagnóstico + plan)
├── docs/
│   └── GITOPS.md           Arquitectura GitOps (repos, ArgoCD, decisiones)
├── terraform/              Namespace, ResourceQuota, LimitRange, RBAC de ArgoCD
│   ├── providers.tf
│   ├── variables.tf
│   ├── main.tf
│   └── outputs.tf
└── helm/                   7 charts independientes (uno por componente)
    ├── gateway/
    ├── ms-users/
    ├── ms-products/
    ├── ms-orders/
    ├── ms-notifications/
    ├── cronjob-heartbeat/
    └── cronjob-summary/
```

## 4. Entorno disponible para la demostración

Verificado con comandos reales durante esta fase (no asumido):

| Herramienta | Estado en esta máquina |
|---|---|
| `helm` | ✅ instalado (v4.2.4) — los 7 charts pasan `helm lint`/`helm template` |
| `kubectl` | ✅ instalado (v1.32.2) |
| `docker` | ✅ instalado |
| `k6` | ✅ instalado (v2.2.0) — se reutilizará para los load tests (Fase 6) |
| `terraform` | ❌ no instalado — el código en `terraform/` no se ha podido validar con `terraform validate`/`plan`/`apply` todavía |
| `cosign`, `trivy`, `syft`, `argocd` (CLI), `kubectl-argo-rollouts` | ❌ no instalados localmente — se usarán dentro del pipeline de GitHub Actions (Fase 5) o deben instalarse en el clúster/máquina para probarlos en local |
| Clúster de Kubernetes accesible | ❌ **no hay ninguno corriendo ahora mismo**: `kubectl config get-contexts` muestra los contextos `docker-desktop` y `minikube`, pero ninguno tiene `current-context` fijado y `kubectl get nodes` no logra conectar a ninguno de los dos. Es necesario **encender Docker Desktop Kubernetes o `minikube start`** antes de instalar ArgoCD/Argo Rollouts/Kyverno y demostrar el flujo end-to-end. |
| Repositorio GitOps independiente | ❌ no existe todavía — el estudiante lo crea manualmente (ver [docs/GITOPS.md, sección 5](docs/GITOPS.md#5-qué-debe-crear-manualmente-el-estudiante-en-github)) |

No hay GKE de P6 disponible (fue eliminado el 05/09/2026 por costo), así que
la demo de P8 se hace contra un clúster local.
