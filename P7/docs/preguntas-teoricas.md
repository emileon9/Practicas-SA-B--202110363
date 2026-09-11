# Preguntas teóricas — Práctica 7

Software Avanzado (USAC) · Carné **202110363**

Cada respuesta se ancla a una decisión real tomada en
[.github/workflows/ci.yml](../../.github/workflows/ci.yml) y
[.github/workflows/cd.yml](../../.github/workflows/cd.yml), no a una
definición genérica de manual.

## ¿Qué es CI (Integración Continua)?

Es la práctica de fusionar e integrar cambios de código con frecuencia,
verificando automáticamente en cada integración que el sistema sigue
compilando y pasando sus pruebas. En este proyecto, `ci.yml` se dispara en
**cada push a cualquier rama y en cada Pull Request hacia `master`**: si
alguien rompe el build de `ms-users` (por ejemplo un error de tipos en
`tsc`) o una prueba de `pytest` en `ms-orders`, el pipeline falla antes de
que ese cambio llegue a `master`, no después.

## ¿Qué es CD (Despliegue/Entrega Continua)?

Es la automatización de lo que ocurre *después* de que CI confirma que el
código es válido: llevar ese código a un entorno de ejecución sin
intervención manual. Aquí es **Despliegue Continuo** (no solo entrega):
`cd.yml` no se detiene a esperar una aprobación humana — en cuanto `CI`
termina en éxito sobre `master`, ejecuta `helm upgrade --install`
automáticamente sobre el clúster de Kubernetes.

## ¿Qué diferencia existe entre CI y CD?

CI responde la pregunta "¿este cambio compila y pasa las pruebas?". CD
responde "¿este cambio ya está corriendo en el entorno real?". En este
repositorio son dos workflows físicamente separados
(`ci.yml` / `cd.yml`) precisamente para que esa frontera sea explícita: CI
puede fallar en una rama feature sin que eso implique tocar el clúster; CD
solo se dispara cuando CI ya confirmó éxito sobre `master`
(`workflow_run` + `conclusion == 'success'` + `head_branch == 'master'`).

## ¿Qué función cumple GitHub Actions?

Es el motor de automatización nativo de GitHub que ejecuta los workflows
definidos en `.github/workflows/*.yml` en respuesta a eventos del propio
repositorio (`push`, `pull_request`, `workflow_run`, etc.), sin necesidad de
un servidor de CI externo (Jenkins, CircleCI...). Todo el pipeline de esta
práctica vive dentro del mismo repositorio y se dispara solo con git.

## ¿Qué es un workflow?

Es un archivo YAML (`ci.yml`, `cd.yml`) que declara: qué eventos lo
disparan (`on:`), qué trabajos (`jobs:`) debe ejecutar, en qué orden
(`needs:`) y bajo qué condiciones (`if:`). Un mismo repositorio puede tener
varios workflows independientes — aquí hay exactamente dos, con
responsabilidades distintas (CI vs CD).

## ¿Qué es un runner?

Es la máquina que realmente ejecuta los pasos de un job. Este proyecto usa
**dos tipos de runner a propósito**: los jobs de `ci.yml`
(`test-node`, `test-python`, `docker-validate`, `docker-build-push`) corren
en `ubuntu-latest`, un runner *hosted* por GitHub en la nube, porque no
necesitan nada más que Node/Python/Docker. El job `deploy` de `cd.yml`
corre en un runner **self-hosted** — la propia laptop del estudiante —
porque es la única máquina que tiene acceso de red al clúster de
Kubernetes local (Docker Desktop / minikube); un runner de GitHub en la
nube no podría alcanzarlo.

## ¿Qué es una imagen Docker (Docker image)?

Es un artefacto inmutable que empaqueta el código de un microservicio junto
con su runtime y dependencias exactas. Cada uno de los 7 componentes del
sistema (`gateway`, `ms-users`, `ms-products`, `ms-orders`,
`ms-notifications`, `cronjob-heartbeat`, `cronjob-summary`) tiene su propio
Dockerfile multi-stage (heredado de P4/P5) que produce una imagen final sin
herramientas de build, corriendo como usuario no-root.

## ¿Qué es un contenedor (container)?

Es una instancia en ejecución de una imagen Docker. La misma imagen
`ghcr.io/emileon9/sa-platform/gateway:<sha>` puede levantar varios
contenedores idénticos a la vez — de hecho el chart de Helm pide
`replicaCount: 2` para `gateway` en `values.yaml`, es decir, dos
contenedores corriendo la misma imagen detrás del mismo Service de
Kubernetes.

## ¿Qué es un registry (registro de contenedores)?

Es el repositorio donde se publican y versionan las imágenes construidas,
para que cualquier nodo del clúster pueda descargarlas por nombre y tag en
vez de tener que construirlas localmente. Este proyecto usa **GitHub
Container Registry (GHCR)**, autenticado con el `GITHUB_TOKEN` que Actions
genera automáticamente por ejecución — sin necesidad de crear ni almacenar
un secret adicional para el push.

## ¿Qué es Kubernetes?

Es el orquestador que mantiene corriendo el número deseado de réplicas de
cada microservicio, las reinicia si fallan sus probes de `/health`, y
expone el sistema completo a través de un Ingress. En este proyecto,
Kubernetes ya estaba resuelto desde P5 (chart `sa-platform`, namespace
`sa-p5`); P7 no cambia esa arquitectura, solo automatiza *cuándo* y *con
qué imagen* se le pide a Kubernetes actualizar cada Deployment.

## ¿Qué es un Deployment?

Es el recurso de Kubernetes que declara "quiero N réplicas de esta imagen,
corriendo así". El chart define un Deployment por microservicio (`gateway`,
`ms-users`, `ms-products`, `ms-orders`, `ms-notifications`) con
`strategy: RollingUpdate` y `maxUnavailable: 0`, por lo que un
`helm upgrade` (como el que ejecuta `cd.yml`) no tumba las réplicas viejas
hasta que las nuevas — con la imagen nueva — pasan su `readinessProbe`.

## ¿Qué es un Service?

Es el recurso que da una identidad de red estable (DNS interno del
clúster) a un conjunto de Pods, aunque estos se reemplacen en cada
despliegue. Por ejemplo, el gateway llega a `ms-users` siempre como
`http://ms-users:4001` (ver `extraEnv` en `values.yaml`), sin conocer la IP
real de ningún Pod — eso es exactamente lo que resuelve el Service.

## ¿Por qué utilizar versionamiento de imágenes?

Porque una imagen con tag mutable (`latest`) no permite saber qué código
está corriendo realmente ni volver atrás de forma confiable. Por eso
`docker-build-push` etiqueta cada imagen con **el SHA del commit**
(`${{ github.sha }}`) además de `latest`, y `cd.yml` despliega
explícitamente ese SHA con `--set gateway.image.tag=<sha>`: el Deployment
en Kubernetes queda trazable a un commit exacto, y un `helm rollback`
siempre vuelve a un conjunto de imágenes conocido, no a "lo que fuera
`latest` en ese momento".

## ¿Qué ventajas ofrece automatizar el despliegue?

Elimina el paso manual "yo construyo la imagen en mi laptop, la subo a
mano y corro `helm upgrade`" — que es exactamente lo que se hizo en P6 a
mano. Automatizarlo (P7) garantiza que la imagen desplegada es siempre la
que de verdad pasó los tests, con un tag trazable, sin el riesgo humano de
olvidar reconstruir una imagen o desplegar la versión equivocada.

## ¿Qué riesgos existen en un pipeline CI/CD?

Riesgos reales identificados y mitigados en este pipeline concreto:

- **Publicar una imagen que nunca corrió pruebas**: mitigado con
  `docker-build-push` declarado `needs: [docker-validate]`, que a su vez
  corre después de `test-node`/`test-python` — no se publica nada sin que
  el build y los tests hayan pasado primero.
- **Desplegar automáticamente algo roto**: mitigado con
  `helm upgrade --wait` + `kubectl rollout status`; si el rollout no
  completa en el timeout, el job de CD falla y queda visible en Actions en
  vez de reportarse como "desplegado" silenciosamente.
- **Secretos expuestos en el pipeline**: mitigado no generando ningún
  secret nuevo para GHCR (usa el `GITHUB_TOKEN` efímero de cada run) y
  manteniendo las contraseñas de PostgreSQL/RabbitMQ **fuera de GitHub por
  completo** — viven solo en un archivo local del runner self-hosted,
  referenciado por ruta a través de una variable de repositorio no
  sensible (`SA_PLATFORM_SECRETS_PATH`).
- **Runner self-hosted comprometido**: es un riesgo real y documentado (ver
  `P7/README.md` → "Problemas conocidos"): a diferencia de un runner
  hosted por GitHub (efímero, aislado), un self-hosted runner es la propia
  máquina del estudiante, con acceso directo a su clúster local — un
  workflow malicioso en un PR externo podría, en teoría, ejecutar código en
  esa máquina. Por eso `cd.yml` **no** se dispara por `pull_request`, solo
  por `workflow_run` tras un push directo a `master`.
