# Seguridad

## RBAC de minimo privilegio

Cada uno de los 5 microservicios y los 2 CronJobs tiene su **propio**
`ServiceAccount` (nunca `default`), con un `Role` y `RoleBinding` scoped al
namespace `sa-p5`. Ninguno de estos workloads llama al API server de
Kubernetes en tiempo de ejecucion (las variables de ConfigMap/Secret se
inyectan por el kubelet via `envFrom`, que no requiere permisos RBAC), asi
que el `Role` es intencionalmente minimo: solo `get` sobre su propio
ConfigMap (`sa-platform-config`), como demostracion del patron de minimo
privilegio, no porque la aplicacion lo necesite para funcionar.

```yaml
rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    resourceNames: ["sa-platform-config"]
    verbs: ["get"]
```

Ver `templates/rbac.yaml` de cada subchart y
`templates/cronjob-{heartbeat,summary}.yaml` en el chart padre.

## securityContext restrictivo

Los 7 contenedores propios de la plataforma (5 microservicios + 2
CronJobs) declaran:

```yaml
securityContext:
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  runAsNonRoot: true
  capabilities:
    drop: ["ALL"]
```

Mas `runAsNonRoot: true` a nivel de Pod. Esto funciona porque:

- Las imagenes Node (`gateway`, `ms-users`, `ms-products`) corren con
  `USER node` (uid 1000, incluido en `node:20-alpine`).
- Las imagenes Python (`ms-orders`, `ms-notifications`,
  `cronjob-heartbeat`, `cronjob-summary`) crean explicitamente un usuario
  de sistema `app` (`addgroup --system app && adduser --system ...`) en el
  `Dockerfile`.

**`readOnlyRootFilesystem: true` se verifico ANTES de escribirlo en el
chart**, no se asumio: se corrio cada imagen localmente con
`docker run --read-only --tmpfs /tmp` y las dos arrancaron y respondieron
`/health` sin errores de escritura (ver Fase 3 del historial de
implementacion). El unico directorio que necesita escritura es `/tmp`
(temporales del runtime de Node/Python), por eso cada Pod monta un
`emptyDir` ahi — no hay ninguna otra ruta de escritura requerida.

## Imagenes: multi-stage build y tamano

Todas las imagenes usan **multi-stage build** (`Dockerfile` de cada
servicio en `P5/services/*` y `P5/jobs/*`) sobre una base minima
(`node:20-alpine` / `python:3.12-slim`).

| Imagen | Original (P4, single/multi-stage segun el caso) | Optimizada (P5, multi-stage + non-root) | Reduccion |
|---|---|---|---|
| gateway | 48.8 MB | 47.5 MB | 2.8% |
| ms-users | 48.3 MB | 47.1 MB | 2.5% |
| ms-products | 48.3 MB | 47.1 MB | 2.5% |
| ms-orders | 55.9 MB | 52.6 MB | 5.8% |
| ms-notifications | 55.9 MB | 52.6 MB | 5.8% |

Nota honesta: los tres servicios Node de P4 **ya** eran multi-stage sobre
alpine, asi que la reduccion ahi es marginal (limpieza de cache de npm). La
ganancia real esta en los dos servicios Python, que en P4 eran
single-stage (`python:3.12-slim` directo) y en P5 pasaron a multi-stage con
`pip install --user` + copia selectiva de `/root/.local`. Medido con
`docker image inspect <imagen> --format='{{.Size}}'`.

## Valores de las probes: justificacion

| Servicio | startup (periodSeconds x failureThreshold) | liveness | readiness | Justificacion |
|---|---|---|---|---|
| gateway | 5s x 12 = 60s max de arranque | delay 5s, cada 10s | delay 2s, cada 5s | Express arranca en <1s, pero el startup se deja holgado (60s) porque en el primer `helm install` el gateway puede quedar en `CrashLoopBackOff` esperando a que ms-users/ms-products/etc. resuelvan DNS mientras el cluster aun esta desplegando todo en paralelo. |
| ms-users, ms-products | 5s x 10 = 50s max | delay 5s, cada 10s | delay 2s, cada 5s | Servicios Node muy livianos (arrancan en <500ms tipicamente); el margen es para tolerar contencion de CPU durante un rollout o un scale-up del HPA. |
| ms-orders, ms-notifications | 5s x 12 = 60s max | delay 8s, cada 10s | delay 3s, cada 5s | FastAPI + Uvicorn tarda algo mas en arrancar que Express, y `ms-notifications` ademas abre una conexion a RabbitMQ en el evento `startup` (con reintentos cada 5s si el broker aun no esta listo), por lo que el `initialDelaySeconds` de liveness/readiness es mayor que en los servicios Node. |

## No requerido pero verificado

`helm lint` no reporta ninguna advertencia relacionada a seguridad; no se
uso `privileged: true` en ningun contenedor; ningun Secret se referencia
por valor literal en un template (todos via `required` sobre un value sin
default).
