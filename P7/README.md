# Práctica 7 — Integración y Despliegue Continuo (CI/CD)

Software Avanzado (USAC) · Carné **202110363**

Automatiza con GitHub Actions el flujo completo del sistema de
microservicios construido en la [Práctica 5](../P5) y desplegado en la nube
en la [Práctica 6](../P6): **checkout → install → build → test → docker
build → docker push (GHCR) → despliegue con Helm en Kubernetes →
verificación del rollout**. No se reescribió ningún microservicio, chart de
Helm ni Dockerfile: P7 solo agrega automatización y, donde no existían,
pruebas automatizadas reales.

## 1. Objetivo

Configurar un pipeline de Integración y Despliegue Continuo que tome el
código ya existente de P5 (5 microservicios + gateway + 2 CronJobs, todos
empaquetados en un único chart de Helm) y automatice: pruebas, construcción
de imágenes Docker, publicación en un registro de contenedores, y
actualización del despliegue en Kubernetes.

## 2. Arquitectura

La arquitectura de aplicación **no cambió respecto a P5/P6**
(ver [P5/docs/architecture.md](../P5/docs/architecture.md)). Lo que agrega
P7 es la capa de automatización alrededor de ella:

```
Código (P5/services, P5/jobs)
   │  git push / PR
   ▼
GitHub Actions: CI  (.github/workflows/ci.yml)
   │  build + test + docker build (validación)
   │  → si es push a master: docker build + push a GHCR
   ▼
GitHub Container Registry (ghcr.io/emileon9/sa-platform/<servicio>)
   │  workflow_run (CI success en master)
   ▼
GitHub Actions: CD  (.github/workflows/cd.yml)
   │  helm upgrade --install (runner self-hosted)
   ▼
Kubernetes (namespace sa-p5, chart P5/charts/sa-platform)
```

Diagrama completo con nombres reales de cada job:
**[docs/pipeline-diagram.md](docs/pipeline-diagram.md)**.

## 3. Microservicios utilizados (reales, de P5)

| Servicio | Stack | Puerto | Dockerfile | Tests agregados en P7 |
|---|---|---|---|---|
| `gateway` | Node 20 / TypeScript / Express | 4000 | [P5/services/gateway/Dockerfile](../P5/services/gateway/Dockerfile) | [P5/services/gateway/tests](../P5/services/gateway/tests) |
| `ms-users` | Node 20 / TypeScript / Express + GraphQL | 4001 | [P5/services/ms-users/Dockerfile](../P5/services/ms-users/Dockerfile) | [P5/services/ms-users/tests](../P5/services/ms-users/tests) |
| `ms-products` | Node 20 / TypeScript / Express + GraphQL | 4002 | [P5/services/ms-products/Dockerfile](../P5/services/ms-products/Dockerfile) | [P5/services/ms-products/tests](../P5/services/ms-products/tests) |
| `ms-orders` | Python 3.12 / FastAPI | 4003 | [P5/services/ms-orders/Dockerfile](../P5/services/ms-orders/Dockerfile) | [P5/services/ms-orders/tests](../P5/services/ms-orders/tests) |
| `ms-notifications` | Python 3.12 / FastAPI + pika + psycopg2 | 4004 | [P5/services/ms-notifications/Dockerfile](../P5/services/ms-notifications/Dockerfile) | [P5/services/ms-notifications/tests](../P5/services/ms-notifications/tests) |
| `cronjob-heartbeat` | Python | — | [P5/jobs/cronjob-heartbeat/Dockerfile](../P5/jobs/cronjob-heartbeat/Dockerfile) | (sin tests: script de una sola sentencia, ver P5/docs) |
| `cronjob-summary` | Python | — | [P5/jobs/cronjob-summary/Dockerfile](../P5/jobs/cronjob-summary/Dockerfile) | (sin tests: idéntico caso anterior) |

Ninguno de estos nombres fue inventado: son los mismos directorios que ya
existían en `P5/services` y `P5/jobs`.

## 4. Flujo CI/CD

### CI — [.github/workflows/ci.yml](../.github/workflows/ci.yml)

Se dispara en **push a cualquier rama** y en **Pull Request hacia
`master`**, solo si hay cambios en `P5/services/**`, `P5/jobs/**` o el
propio workflow.

| Job | Qué hace |
|---|---|
| `test-node` (matrix: gateway, ms-users, ms-products) | `npm ci` → `npm run build` (tsc) → `npm test` (Jest) |
| `test-python` (matrix: ms-orders, ms-notifications) | `pip install -r requirements-dev.txt` → `pytest` |
| `docker-validate` (matrix: las 7 imágenes) | `docker build` de cada Dockerfile real, **sin publicar** — valida que el Dockerfile sigue funcionando |
| `docker-build-push` (matrix: las 7 imágenes; **solo si `push` a `master`**) | Login en GHCR con `GITHUB_TOKEN` → build + push con tag `<sha>` y `latest` |

### CD — [.github/workflows/cd.yml](../.github/workflows/cd.yml)

Se dispara con `workflow_run` cuando `CI` termina en éxito sobre `master`
(es decir, después de que las imágenes ya están en GHCR). Corre en un
**runner self-hosted** (ver sección Kubernetes) y ejecuta:

1. `helm repo add bitnami ...` + `helm dependency build` (las dependencias
   `postgresql`/`rabbitmq` están gitignored, se reconstruyen en cada run).
2. `helm upgrade --install sa-platform P5/charts/sa-platform` con
   `-f values-dev.yaml -f P7/helm/values-ci.yaml -f <secrets locales>` y
   `--set <servicio>.image.tag=<sha del commit>` para los 7 componentes.
3. `kubectl rollout status deployment/<nombre>` por cada uno de los 5
   Deployments (los CronJobs no tienen rollout que verificar de la misma
   forma; se listan con `kubectl get cronjobs`).
4. `kubectl get pods|deployments|cronjobs -n sa-p5` como evidencia final.

**Por qué es `helm upgrade` y no `kubectl set image`**: el chart
`sa-platform` ya administra el Deployment completo (probes, recursos,
ConfigMap, Secrets) y P5/P6 establecieron explícitamente la convención de
**nunca usar `kubectl apply -f`** (ver [P5/README.md](../P5/README.md)).
Usar `kubectl set image` directamente rompería esa convención y
desincronizaría el estado de Helm del estado real del clúster.

## 5. Build

Comandos reales de cada `package.json` (no inventados):

```bash
# Cada servicio Node (gateway, ms-users, ms-products)
npm run build   # tsc, ya existía en P4/P5
```

Versión de Node usada en CI: **20**, la misma que fijan los Dockerfiles
(`FROM node:20-alpine`, ver P5/services/*/Dockerfile) — ningún
`package.json` tenía `engines`, así que se alineó el CI a lo que Docker ya
usaba en producción, no al revés.

## 6. Tests

**No existía ningún test en el repositorio antes de P7** (se verificó: sin
`jest.config`, sin `pytest.ini`, sin script `test` en ningún
`package.json`). Se agregaron pruebas reales, no cosméticas, sobre la
lógica de negocio existente:

- `ms-users` / `ms-products`: pruebas unitarias sobre `getUsers()` /
  `getProducts()` (forma de los datos, IDs únicos) + prueba de integración
  con Supertest sobre `GET /health`.
- `gateway`: prueba de `GET /health`, prueba de que
  `createServiceProxy()` produce middleware válido, y prueba de que un
  path no mapeado (`/api/no-existe`) cae en el 404 de Express **sin**
  intentar una llamada de red hacia otro microservicio (evita que el test
  dependa de que `ms-users`/etc. estén corriendo).
- `ms-orders` / `ms-notifications`: pruebas con `fastapi.testclient` sobre
  `/health` y sus endpoints reales (`/orders`, `/notifications`).

Ninguna prueba requiere PostgreSQL ni RabbitMQ: los 4 microservicios REST
sirven datos en memoria, y el único punto que sí intenta hablar con
RabbitMQ (`ms-notifications`, hilo de fondo `summary_consumer.start()`)
**retorna de inmediato si `BROKER_HOST` no está seteado** (ver
[app/services/summary_consumer.py](../P5/services/ms-notifications/app/services/summary_consumer.py#L53-L60)),
así que el `TestClient` arranca sin bloquear ni requerir infraestructura.
Verificado localmente: los 5 servicios pasan `build`+`test` (ver sección
11).

## 7. Docker

Los Dockerfiles de P5 **no se modificaron**: ya eran multi-stage, ya
corrían como usuario no-root (`USER node` / `USER app`), y ya tenían
`.dockerignore`. P7 solo los conecta a un pipeline que los construye
automáticamente. Las 7 imágenes reales:

```
gateway, ms-users, ms-products, ms-orders, ms-notifications,
cronjob-heartbeat, cronjob-summary
```

## 8. Registry

**GitHub Container Registry (GHCR)**, por ser la opción por defecto sin
razón en contra: se autentica con el `GITHUB_TOKEN` efímero de cada
ejecución (no requiere crear ni almacenar ningún secret adicional), y
queda ligado de forma nativa al mismo repositorio.

Convención de nombres e imagen:

```
ghcr.io/emileon9/sa-platform/<servicio>:<sha-del-commit>
ghcr.io/emileon9/sa-platform/<servicio>:latest
```

## 9. Kubernetes

El chart de Helm `sa-platform` ([P5/charts/sa-platform](../P5/charts/sa-platform))
ya existía completo desde P5 (Deployments, Services, HPA, NetworkPolicy,
RBAC, probes en `/health`) y P6 ya demostró que se adapta a un proveedor de
nube distinto solo con un overlay de valores
([P6/helm/values-gke.yaml](../P6/helm/values-gke.yaml)). P7 sigue
exactamente ese mismo patrón con
**[helm/values-ci.yaml](helm/values-ci.yaml)**, que solo cambia el
`repository` de cada imagen a GHCR — el tag real lo inyecta `cd.yml` en
tiempo de despliegue con `--set`.

### Limitación real y honesta (léase antes de intentar reproducir el deploy)

El clúster de GKE usado en la Práctica 6 **fue eliminado deliberadamente el
05/09/2026** para no seguir generando costo (ver
[P6/README.md](../P6/README.md#16-dirección-pública-utilizada) y
`P6/docs/eliminacion.md`). Hoy no existe ningún clúster de Kubernetes
accesible desde internet. Un runner *hosted* por GitHub (en la nube) **no
puede conectarse** a un clúster que vive en la laptop del estudiante
(Docker Desktop Kubernetes / minikube, verificado con
`kubectl config get-contexts` durante el desarrollo de esta práctica: solo
existen los contextos `docker-desktop` y `minikube`, ningún contexto de
GKE).

**Solución adoptada** (decidida junto con el estudiante, ver Pendientes):
el job de deploy de `cd.yml` corre en un **runner self-hosted** — la propia
máquina del estudiante, registrada como runner de Actions — que sí tiene
acceso directo a `docker-desktop`/`minikube` porque es la misma máquina.
Esto evita también recrear el clúster de GKE y volver a pagar por él solo
para la demo.

### Registrar el runner self-hosted (una sola vez)

1. En GitHub: **Settings → Actions → Runners → New self-hosted runner**,
   elegir Windows.
2. Seguir los comandos exactos que GitHub muestra en esa pantalla
   (descargan `actions-runner`, lo configuran con un token de un solo uso
   generado por GitHub, y lo registran contra este repositorio). No se
   documentan aquí porque el token expira y es distinto cada vez que se
   genera.
3. Confirmar que, en esa misma máquina, `kubectl config current-context`
   apunta al clúster que se quiere usar (`docker-desktop` o `minikube`) y
   que el clúster está encendido.
4. Ejecutar el runner (`run.cmd` o como servicio) **antes** de hacer push a
   `master`, para que esté disponible cuando `cd.yml` intente correr.

### Cómo se actualiza el Deployment

`cd.yml` ejecuta `helm upgrade --install sa-platform ... --set
gateway.image.tag=<sha> --set ms-users.image.tag=<sha> ...` para los 7
componentes. Gracias a `strategy.rollingUpdate.maxUnavailable: 0` (ya
definido en cada Deployment del chart), Kubernetes no apaga las réplicas
viejas hasta que las nuevas — con la imagen recién publicada — pasan su
`readinessProbe` en `/health`.

## 10. Versionamiento

Estrategia implementada (sin complejidad adicional):

| Evento | CI | Docker Build + Push | Deploy |
|---|---|---|---|
| Pull Request → `master` | ✓ | ✗ | ✗ |
| Push a cualquier rama != `master` | ✓ | ✗ | ✗ |
| Push a `master` | ✓ | ✓ (tag = SHA + `latest`) | ✓ (automático, vía `workflow_run`) |

Cada imagen queda etiquetada con el **SHA del commit** que la originó, no
solo `latest` — esto permite trazar exactamente qué commit está corriendo
en el clúster (`kubectl describe pod ... | grep Image`) y hacer
`helm rollback` a un estado con imágenes conocidas si algo falla.

## 11. Secrets y configuración requerida

**No se necesita ningún secret nuevo para publicar en GHCR** — usa el
`GITHUB_TOKEN` que Actions genera automáticamente por ejecución. Sí se
necesita esta configuración manual (nombre exacto, dónde, tipo de valor):

| Nombre | Tipo | Dónde configurarlo | Para qué sirve | Valor esperado |
|---|---|---|---|---|
| *(sin nombre, es un ajuste, no un secret)* Workflow permissions | Configuración del repo | `Settings → Actions → General → Workflow permissions` | Sin esto, `GITHUB_TOKEN` es de solo lectura y `docker-build-push` falla al hacer `docker push` a GHCR con 403 | Seleccionar **"Read and write permissions"** |
| `SA_PLATFORM_SECRETS_PATH` | **Variable** de repositorio (no secret: es solo una ruta de archivo, no una credencial) | `Settings → Secrets and variables → Actions → Variables → New repository variable` | Le dice a `cd.yml` dónde, en el disco del runner self-hosted, está la copia local de `values-secrets.yaml` (nunca versionada, ver `P5/.gitignore`) | Ruta absoluta en la máquina del runner, ej. `C:/ci-secrets/sa-platform/values-secrets.yaml` |
| Runner self-hosted registrado | Infraestructura | `Settings → Actions → Runners` | Es la máquina que ejecuta `cd.yml` — debe tener `helm`, `kubectl` y un contexto de clúster local funcionando | N/A (procedimiento de registro, no un valor a escribir) |

No se requiere `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` ni ningún
`KUBECONFIG` como secret: al ser un runner self-hosted, el acceso al
clúster ya existe en esa máquina (el mismo `kubectl` que el estudiante usa
para P5), no necesita viajar por GitHub.

**Importante — por qué `values-secrets.yaml` no puede vivir dentro del
checkout**: `actions/checkout` limpia el workspace (`git clean -ffdx`) en
cada ejecución; un archivo dejado dentro de `P5/charts/sa-platform/` se
borraría en la siguiente corrida. Por eso debe copiarse **fuera** del
directorio del repositorio, y `SA_PLATFORM_SECRETS_PATH` apunta a esa copia
externa.

## 12. Cómo ejecutar localmente

```bash
# Node (gateway, ms-users, ms-products)
cd P5/services/<servicio>
npm ci
npm run build
npm test

# Python (ms-orders, ms-notifications)
cd P5/services/<servicio>
python -m venv .venv && .venv/Scripts/activate   # o source .venv/bin/activate
pip install -r requirements-dev.txt
pytest -v

# Validar el chart de Helm con el overlay de CI (sin tocar ningun cluster)
cd P5/charts/sa-platform
helm repo add bitnami https://charts.bitnami.com/bitnami --force-update
helm dependency build .
helm template sa-platform . -n sa-p5 \
  -f values-dev.yaml -f ../../../P7/helm/values-ci.yaml \
  --set postgresql.auth.password=dummy --set rabbitmq.auth.password=dummy \
  --set gateway.image.tag=local-test
```

## 13. Cómo ejecutar/verificar el pipeline

1. Hacer un Pull Request hacia `master` con un cambio en `P5/services/**` →
   observar en la pestaña **Actions** que `CI` corre `test-node`,
   `test-python` y `docker-validate` (sin `docker-build-push`).
2. Mergear a `master` → `CI` corre completo, incluyendo
   `docker-build-push`; al terminar en éxito, `CD` se dispara solo y
   ejecuta el deploy en el runner self-hosted.

## 14. Cómo verificar Docker

```bash
# Localmente, igual a lo que hace docker-validate en CI
docker build -t sa-platform/gateway:local P5/services/gateway
docker build -t sa-platform/ms-orders:local P5/services/ms-orders
```

En GitHub: pestaña **Packages** del repositorio (o
`https://github.com/emileon9?tab=packages`) tras el primer push a
`master`.

## 15. Cómo verificar Kubernetes

```bash
kubectl config current-context          # debe ser docker-desktop o minikube
kubectl get deployments -n sa-p5 -o wide
kubectl get pods -n sa-p5 -o wide
kubectl get cronjobs -n sa-p5
kubectl rollout status deployment/gateway -n sa-p5
```

## 16. Problemas conocidos

- **El deploy real (CD) no se ha ejecutado end-to-end todavía**: depende de
  que el estudiante registre el runner self-hosted y encienda su clúster
  local (ver sección 9 y Pendientes). El workflow fue validado
  estáticamente (`helm template` renderiza los 73 recursos sin error, con
  las 7 imágenes apuntando correctamente a GHCR), pero un `helm template`
  no ejecuta ningún Pod real — eso solo lo confirma un `helm upgrade` real.
- **`cronjob-heartbeat` y `cronjob-summary` no tienen pruebas
  automatizadas**: son scripts de una sola función (insertar una fila /
  publicar un mensaje), ya cubiertos funcionalmente por la evidencia de
  P5/P6 (`P5/docs/evidence.md`); agregar tests solo para ellos habría sido
  una prueba cosmética sin lógica real que validar.
- **Un self-hosted runner es un riesgo de seguridad si se expone a
  Pull Requests externos**: por eso `cd.yml` nunca se dispara por
  `pull_request`, solo por `workflow_run` después de un push directo a
  `master` (ver `P7/docs/preguntas-teoricas.md`, última pregunta).

## 17. Evidencias que deben capturarse para la entrega

Ver **[docs/evidencias.md](docs/evidencias.md)** — checklist completo,
ninguna captura fue inventada ni asumida.

## 18. Preguntas teóricas

Ver **[docs/preguntas-teoricas.md](docs/preguntas-teoricas.md)**.

## 19. Auditoría contra la rúbrica

Ver **[docs/rubrica.md](docs/rubrica.md)** — estado real
`[✓]`/`[!]`/`[✗]` de cada criterio, con lo que falta para el máximo puntaje.

## 20. Pendientes (acción manual del estudiante)

1. En GitHub: `Settings → Actions → General → Workflow permissions` →
   seleccionar **"Read and write permissions"** (requerido para el push a
   GHCR).
2. Registrar un runner self-hosted (`Settings → Actions → Runners → New
   self-hosted runner`) en la máquina donde ya corre `docker-desktop` o
   `minikube`.
3. Crear la variable de repositorio `SA_PLATFORM_SECRETS_PATH` apuntando a
   una copia de `P5/charts/sa-platform/values-secrets.yaml` guardada
   **fuera** del checkout del repositorio, en esa misma máquina.
4. Con el clúster local encendido y el runner corriendo, hacer push a
   `master` y capturar las evidencias de
   [docs/evidencias.md](docs/evidencias.md).

## Estructura de archivos de esta práctica

```
P7/
├── README.md                  Este archivo
├── helm/
│   └── values-ci.yaml         Overlay: repositorios de imagen -> GHCR
└── docs/
    ├── pipeline-diagram.md    Diagrama Mermaid del pipeline completo
    ├── preguntas-teoricas.md  15 preguntas teoricas del enunciado
    ├── rubrica.md             Auditoria [✓]/[!]/[✗] contra la rubrica
    └── evidencias.md          Checklist de capturas para la entrega

.github/workflows/
├── ci.yml                     build + test + docker build/push
└── cd.yml                     helm upgrade + verificacion de rollout
```

Los tests nuevos viven junto al código que prueban (convención estándar de
Jest/pytest), no dentro de `/P7`:

```
P5/services/gateway/tests/gateway.test.ts
P5/services/ms-users/tests/users.test.ts
P5/services/ms-products/tests/products.test.ts
P5/services/ms-orders/tests/test_orders.py
P5/services/ms-notifications/tests/test_notifications.py
```
