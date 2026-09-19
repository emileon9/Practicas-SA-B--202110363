# Práctica 8 — GitOps, entrega progresiva y seguridad de la cadena de suministro

Software Avanzado (USAC) · Carné **202110363**

> **Estado real de esta entrega:** todo el código, los manifiestos y los
> pipelines descritos aquí existen en este repositorio y fueron validados
> localmente donde había herramientas disponibles para hacerlo (`helm
> lint`/`helm template` sobre los 8 charts, `npm test` del gateway tras el
> cambio de fallo inducido, sintaxis de los 3 workflows y de todos los
> manifiestos YAML). Lo que requiere un clúster de Kubernetes en vivo,
> Terraform instalado, o el repositorio GitOps ya creado en GitHub, se
> marca explícitamente como `PENDIENTE` — nada de eso se simula ni se
> inventa. Ver la sección 11 (Entorno) para el detalle exacto.

## 1. Descripción

Esta práctica evoluciona el CI/CD de la [Práctica 7](../P7) (GitHub
Actions con `helm upgrade --install` directo al clúster) hacia un modelo
**GitOps** completo sobre el mismo sistema de microservicios construido en
las Prácticas 4, 5 y 6: 5 servicios REST/GraphQL + 2 CronJobs, ahora
empaquetados como **7 charts de Helm independientes** más un chart de
plataforma compartida, desplegados por **ArgoCD**, con **entrega
progresiva (canary)** vía **Argo Rollouts** en el componente de entrada
externa (`gateway`), **infraestructura de namespace administrada por
Terraform**, y controles de **seguridad de cadena de suministro** (Trivy,
SBOM, firma con Cosign, políticas Kyverno, secretos sellados) integrados
al pipeline.

Ningún microservicio, Dockerfile ni lógica de negocio de P4/P5/P6 fue
reescrito: P8 agrega la capa de entrega y seguridad alrededor de lo que ya
funcionaba, y donde una decisión de P7 era incompatible con GitOps (deploy
directo desde Actions, tag `latest`, namespace administrado por Helm), se
documentó la incompatibilidad y se corrigió explícitamente — ver la
sección 12 (Diagnóstico) para el detalle de cada cambio y su justificación.

## 2. Arquitectura del flujo

```
Developer → git tag vX.Y.Z → GitHub Actions
  (tests → helm lint → Trivy → SBOM → build → cosign sign → push a GHCR)
  → Pull Request al repositorio GitOps → merge
  → ArgoCD sincroniza → Argo Rollouts ejecuta el canary de gateway
  (10% → analysis → 30% → analysis → 60% → analysis → 100%)
  → PASS: promoción completa · FAIL: rollback automático a la version estable
```

Diagrama completo (Mermaid, con anotaciones de dónde se valida, quién
aplica cambios, dónde ocurre la promoción/rollback y dónde se aplica
seguridad de supply chain): **[docs/gitops-flow.md](docs/gitops-flow.md)**.

## 3. GitOps

- **Repositorio de código** (este repositorio): charts de Helm
  (`P8/helm/*`), Terraform (`P8/terraform`), manifiestos de ArgoCD
  (`P8/argocd`), políticas de Kyverno (`P8/security/kyverno`), tests y
  pipelines. Nunca despliega directamente al clúster.
- **Repositorio GitOps**: https://github.com/emileon9/practica8-gitops —
  creado, con el contenido inicial de
  [P8/gitops-repo-template/](P8/gitops-repo-template/) ya pusheado
  (`apps/<servicio>/values-{dev,prod}.yaml`, solo el tag de imagen por
  servicio y ambiente). Los 8 manifiestos de `P8/argocd/` ya apuntan a
  esta URL real, y el secret `GITOPS_REPO_TOKEN` + las variables
  `GITOPS_REPO_OWNER`/`GITOPS_REPO_NAME` ya están configurados en este
  repo de código (confirmado) — `gitops-update.yml` puede abrir el Pull
  Request en cuanto se publique un tag `vX.Y.Z`.
- **ArgoCD**: único componente que aplica cambios al clúster. 8
  `Application` (una por componente + una de plataforma) agrupadas en el
  `AppProject` `sa-platform` — ver [P8/argocd/](P8/argocd/). Cada
  `Application` combina dos fuentes: el chart de Helm (repo de código) y
  el archivo de valores por ambiente (repo GitOps).
- **Fuente de verdad**: el estado de los repositorios Git (código +
  GitOps), nunca un `kubectl apply` manual ni un `helm upgrade` ejecutado
  desde CI.

## 4. Helm

**7 charts independientes** (uno por componente, fragmentados desde el
chart umbrella de P5) + **1 chart de plataforma** para recursos
compartidos:

| Chart | Contiene |
|---|---|
| `gateway` | Rollout (Argo Rollouts, no Deployment) + AnalysisTemplate + Ingress + HPA + PDB + RBAC |
| `ms-users`, `ms-products`, `ms-orders` | Deployment + HPA + PDB + RBAC |
| `ms-notifications` | igual, + consume Secret de DB y de broker |
| `cronjob-heartbeat`, `cronjob-summary` | CronJob + RBAC |
| `platform` | ConfigMap compartido, NetworkPolicy, SealedSecrets de DB/broker |

Cada chart de servicio tiene `values.yaml` (base) + `values-dev.yaml` +
`values-prod.yaml`, parametrizando como mínimo: repositorio/tag de imagen,
réplicas, recursos, Service, Ingress (solo `gateway`) y variables de
entorno. Decisión completa de por qué se fragmentó y cómo se resolvieron
los recursos que antes compartía el chart padre:
[docs/GITOPS.md, sección 4](docs/GITOPS.md#4-decisión-un-chart-de-helm-independiente-por-componente).

**Validado** (ejecutado realmente en esta sesión, no asumido):
`helm lint` + `helm template` sobre los 8 charts, con `values.yaml` base y
cada overlay de ambiente → 0 errores. El job `helm-lint` de
`.github/workflows/ci.yml` repite exactamente esto en cada push/PR que
toque `P8/helm/**`.

## 5. Terraform

`P8/terraform/` administra la infraestructura de **plataforma** del
namespace `sa-p5` (los mismos valores reales que antes vivían en
`P5/charts/sa-platform/values.yaml`, migrados aquí para resolver el
solape de responsabilidad entre Helm y Terraform):

- `Namespace` (`sa-p5`)
- `ResourceQuota` (`requests.cpu=3`, `requests.memory=3Gi`, `limits.cpu=6`,
  `limits.memory=6Gi`, `pods=60`)
- `LimitRange` por contenedor (`request` 50m/64Mi, `limit` 250m/256Mi)
- `Role`/`RoleBinding` de mínimo privilegio para el ServiceAccount de
  ArgoCD, **scoping su acceso únicamente al namespace `sa-p5`** (no
  cluster-admin)

**Estado real (verificado con Terraform v1.16.2, instalado en esta
sesión):**

```
$ terraform init      -> "Terraform has been successfully initialized!"
$ terraform validate  -> "Success! The configuration is valid."
$ terraform plan      -> "Plan: 5 to add, 0 to change, 0 to destroy."
```

El plan confirma exactamente los 5 recursos esperados (`Namespace`,
`ResourceQuota`, `LimitRange`, `Role`, `RoleBinding`) con los valores
correctos (`sa-p5`, límites `250m`/`256Mi`, requests `50m`/`64Mi`, reglas
RBAC incluyendo `argoproj.io/rollouts`). `terraform apply` **no** se
ejecutó: requiere un clúster real detrás del contexto `docker-desktop`
(ninguno está corriendo ahora) y aplicar cambios de infraestructura sin un
clúster de destino real no tiene sentido — queda pendiente de correr una
vez el clúster esté encendido.

## 6. Argo Rollouts

Estrategia **canary**, aplicada al componente `gateway` (único punto de
entrada externo de la plataforma — candidato natural para demostrar
entrega progresiva). El resto de los 6 componentes siguen siendo
`Deployment` normales; el mismo patrón se replica igual a cualquiera si se
decide extender el canary.

**3+ pasos, cada uno condicionado por análisis** (ninguna promoción
incondicional):

```
100% estable → 10% nueva (AnalysisTemplate) → 30% nueva (AnalysisTemplate)
→ 60% nueva (AnalysisTemplate) → 100% nueva
```

El `AnalysisTemplate` (`P8/helm/gateway/templates/analysistemplate.yaml`)
usa el provider `job` de Argo Rollouts (sin necesidad de Prometheus):
ejecuta 20 peticiones reales a `GET /health` del propio `gateway` y falla
el paso si la tasa de error supera `10%` o alguna petición excede `1s`
(`maxLatencySeconds`). Si el `AnalysisRun` falla, Argo Rollouts revierte
automáticamente el peso al 100% de la versión estable — sin intervención
manual (ver sección 9).

**Limitación documentada honestamente:** al no usar service mesh, el
Service de `gateway` balancea tráfico entre pods estables y canary de
forma proporcional a sus réplicas (no aislado); el análisis mide por lo
tanto el comportamiento agregado del Service durante cada paso.

## 7. Validaciones automatizadas

Tres categorías, contra endpoints reales (ver
**[docs/TESTING.md](docs/TESTING.md)** para el detalle
requisito→comando→evidencia de cada una):

- **Smoke** ([P8/tests/smoke/smoke-test.sh](tests/smoke/smoke-test.sh)):
  `/health` de los 5 servicios REST, `GET /api/orders/orders`, `GET
  /api/notifications/notifications`, `POST /api/{users,products}/graphql`.
- **Integration** ([P8/tests/integration/integration-test.sh](tests/integration/integration-test.sh)):
  gateway→ms-users (proxy real, no simulado) y la cadena asíncrona
  completa `cronjob-heartbeat → PostgreSQL → cronjob-summary → RabbitMQ →
  ms-notifications`.
- **Load** ([P8/tests/load/README.md](tests/load/README.md)): reutiliza
  `P5/scripts/load-test/k6-script.js` (k6, ya usado en P5) sin duplicarlo;
  umbrales `error rate<5%`, `p95<1500ms`, justificados contra el HPA real
  de `gateway`.

## 8. Seguridad de la cadena de suministro

Ver **[docs/SECURITY.md](docs/SECURITY.md)** para el detalle completo
(comando, configuración, resultado esperado y evidencia de cada control).
Resumen:

- **Trivy**: escanea cada imagen en `gitops-update.yml`, `exit-code: 1`
  ante cualquier `CRITICAL` con parche disponible — bloquea el release.
- **SBOM**: Trivy en formato CycloneDX, subido como artefacto por imagen.
- **Cosign**: firma *keyless* (Sigstore/OIDC de GitHub, sin llave privada
  guardada como secret) tras el push a GHCR.
- **Verificación de firma**: `cosign verify` documentado con el comando
  exacto; el siguiente paso natural (política `verifyImages` de Kyverno)
  queda documentado como pendiente de la identidad OIDC real de un run.
- **Kyverno**: 3 `ClusterPolicy` obligatorias (`disallow-latest`,
  `require-resource-limits`, `disallow-root`), cada una con un manifiesto
  de prueba deliberadamente inválido en `P8/security/kyverno/`.
- **Secretos**: auditoría real del repositorio (sin secretos en texto
  plano encontrados) + migración del `Secret` de DB/broker a
  **SealedSecrets** (`P8/helm/platform/templates/sealedsecrets.yaml`) para
  que el repositorio GitOps pueda versionar el ciphertext sin exponer
  ninguna contraseña.
- **Versionamiento semántico**: `gitops-update.yml` solo se dispara con
  tags `vX.Y.Z`; ninguna imagen se publica ni referencia como `latest`.

## 9. Fallo inducido y rollback automático

`gateway` incluye un hook de fallo controlado, apagado por defecto
(`FAULT_INJECT_RATE=0`, comportamiento idéntico a P5/P7 — verificado con
`npm test`, 3/3 tests siguen pasando). Al publicar un release con
`FAULT_INJECT_RATE` elevado en el overlay del ambiente, `/health` empieza
a fallar con esa probabilidad; el `AnalysisTemplate` del primer paso del
canary lo detecta (tasa de error > 10%) y Argo Rollouts revierte
automáticamente al 100% de la versión estable, sin ejecutar ningún comando
manual. Detalle completo, con los campos de tiempo de recuperación
pendientes de la demo real: **[docs/INCIDENT.md](docs/INCIDENT.md)**.

## 10. Evidencias

| Ítem | Enlace o dato |
|---|---|
| Repositorio de código | https://github.com/emileon9/Practicas-SA-B--202110363 |
| Repositorio GitOps | https://github.com/emileon9/practica8-gitops |
| Aplicación en ArgoCD | 9 Applications en el namespace `argocd`, destino `sa-p5`, **todas `Synced` + `Healthy`**: `sa-platform-gateway`, `-ms-users`, `-ms-products`, `-ms-orders`, `-ms-notifications`, `-cronjob-heartbeat`, `-cronjob-summary`, `-platform`, `-secrets` |
| Ejecución exitosa del pipeline | https://github.com/emileon9/Practicas-SA-B--202110363/actions/runs/35430071282 (7/7 imágenes: Trivy + SBOM + push + cosign, y PR al repo GitOps) |
| Pull Request de actualización de versión | https://github.com/emileon9/practica8-gitops/pull/1 (`Release v1.0.0`, abierto automáticamente por el pipeline) |
| Reversión automática | `AnalysisRun gateway-68766c6b6f-3-1` → `Failed` (20% de error contra umbral de 10%) → `RolloutAborted` → vuelta a `v1.0.0` en 55 s, sin intervención. Detalle completo: [docs/INCIDENT.md](docs/INCIDENT.md) |
| Despliegue rechazado por política | https://github.com/emileon9/Practicas-SA-B--202110363/blob/master/P8/security/evidencia/kyverno-rechazo.txt — salida real de las tres políticas rechazando en admission (`latest`, root, sin límites) |
| Bloqueo por vulnerabilidad crítica | https://github.com/emileon9/Practicas-SA-B--202110363/actions/runs/35429661801 — Trivy detuvo el release por `CVE-2026-59873` (CRITICAL) antes de publicar o firmar; corregido en el commit `435d501` |
| Imagen firmada | `ghcr.io/emileon9/sa-platform/gateway:v1.0.0` — firma verificada con `cosign verify`; certificado emitido a `.../gitops-update.yml@refs/tags/v1.0.0` por `https://token.actions.githubusercontent.com` |
| Reporte de prueba de carga | https://github.com/emileon9/Practicas-SA-B--202110363/blob/master/P5/scripts/load-test/results/summary.json — 9356 peticiones, p95 100.67 ms, 0.00% de error; ambos umbrales (`rate<0.05`, `p(95)<1500`) en `ok: true` |
| Video demostrativo | PENDIENTE — completar con la URL y el minutaje de la sección siguiente |

## Video demostrativo

| Punto | Minuto |
|---|---|
| Arquitectura | 00:00 |
| Pipeline (tests, helm lint, Trivy, SBOM, Cosign) | 00:00 |
| ArgoCD `Synced` + `Healthy` | 00:00 |
| Canary por pasos con AnalysisTemplate | 00:00 |
| Fallo inducido | 00:00 |
| Reversión automática | 00:00 |
| Política de admisión rechazando un despliegue | 00:00 |
| Seguridad (firma verificada, secretos sellados) | 00:00 |

---

## 11. Entorno verificado en esta máquina (no asumido)

| Herramienta | Estado |
|---|---|
| `helm` | ✅ v4.2.4 |
| `kubectl` | ✅ v1.32.2 |
| `docker` | ✅ instalado |
| `k6` | ✅ v2.2.0 |
| `terraform` | ✅ v1.16.2 — `init`/`validate`/`plan` corridos con éxito contra `P8/terraform` (`plan`: 5 to add, 0 to change, 0 to destroy); `apply` pendiente de un clúster real |
| `cosign`, `trivy`, `syft`, `argocd` CLI, `kubectl-argo-rollouts` | ❌ no instalados localmente (se usan dentro de GitHub Actions; instalar localmente solo si se quiere probar fuera del pipeline) |
| Clúster de Kubernetes accesible | ❌ ninguno corriendo ahora (`docker-desktop` y `minikube` existen como contextos, pero ninguno responde) |
| Repositorio GitOps independiente | ✅ creado y activado: https://github.com/emileon9/practica8-gitops, con contenido inicial pusheado y `GITOPS_REPO_TOKEN`/`GITOPS_REPO_OWNER`/`GITOPS_REPO_NAME` ya configurados en el repo de código |

## 12. Diagnóstico del repositorio original y decisiones tomadas

<details>
<summary>Ver diagnóstico completo (arquitectura previa, incompatibilidades detectadas y qué se reutilizó tal cual)</summary>

### Arquitectura previa (P5/P7)

Un único chart de Helm (`sa-platform`, ver
[P5/charts/sa-platform](../P5/charts/sa-platform)) empaquetaba los 7
componentes en el namespace `sa-p5`, con `postgresql`/`rabbitmq`
(Bitnami) como dependencias, y `NetworkPolicy`/`ResourceQuota`/
`LimitRange` definidos dentro del propio chart.

### Servicios reales (sin cambios de lógica de negocio)

| Servicio | Stack | Dockerfile |
|---|---|---|
| `gateway` | Node 20 / TS / Express | [P5/services/gateway/Dockerfile](../P5/services/gateway/Dockerfile) |
| `ms-users` | Node 20 / TS / Express + GraphQL | [P5/services/ms-users/Dockerfile](../P5/services/ms-users/Dockerfile) |
| `ms-products` | Node 20 / TS / Express + GraphQL | [P5/services/ms-products/Dockerfile](../P5/services/ms-products/Dockerfile) |
| `ms-orders` | Python 3.12 / FastAPI | [P5/services/ms-orders/Dockerfile](../P5/services/ms-orders/Dockerfile) |
| `ms-notifications` | Python 3.12 / FastAPI + pika | [P5/services/ms-notifications/Dockerfile](../P5/services/ms-notifications/Dockerfile) |
| `cronjob-heartbeat` | Python | [P5/jobs/cronjob-heartbeat/Dockerfile](../P5/jobs/cronjob-heartbeat/Dockerfile) |
| `cronjob-summary` | Python | [P5/jobs/cronjob-summary/Dockerfile](../P5/jobs/cronjob-summary/Dockerfile) |

### Incompatibilidades detectadas y su corrección

| Incompatibilidad | Corrección aplicada |
|---|---|
| `cd.yml` ejecutaba `helm upgrade --install` directo al clúster desde un runner self-hosted | Su disparador automático fue deshabilitado (ahora `workflow_dispatch` manual únicamente); el flujo vigente es `gitops-update.yml`, que nunca toca el clúster |
| Imágenes etiquetadas también como `latest` | `gitops-update.yml` solo publica el tag semántico del Git tag que lo disparó |
| `ResourceQuota`/`LimitRange`/namespace creados desde el chart de Helm | Movidos a Terraform (`P8/terraform`), con los mismos valores reales |
| Chart umbrella único en vez de "un chart por microservicio" | Fragmentado en 7 charts independientes + 1 de plataforma (`P8/helm/*`) |
| No existía repositorio GitOps independiente | **Creado**: https://github.com/emileon9/practica8-gitops, poblado desde `P8/gitops-repo-template/`; los 8 manifiestos de `P8/argocd/` ya referencian esta URL |

### Qué se reutilizó sin cambios

Los 7 Dockerfiles (multi-stage, no-root), la lógica y las pruebas
unitarias de cada servicio, GHCR como registro, y el script de carga k6 de
P5.

</details>
