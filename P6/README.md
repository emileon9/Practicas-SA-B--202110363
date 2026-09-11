# Práctica 6 — Despliegue de la plataforma en un clúster de Kubernetes en la nube

Software Avanzado · Carné **202110363**



## 1. Introducción

Hasta P5, la plataforma corría únicamente en un clúster local: sin IP
pública, con almacenamiento y balanceo simulados, sin control real de
costos ni identidades. Esta práctica lleva esa misma solución a un entorno
productivo real, usando la capa gratuita / créditos de estudiante de Google
Cloud.

## 2. Objetivo

Desplegar en un clúster de Kubernetes administrado en la nube, con al
menos 2 nodos, la totalidad de los componentes de P5 en ejecución, con una
dirección pública accesible desde internet y evidencia real de
funcionamiento — usando GCP (GKE), `kubectl` y Helm.

## 3. Arquitectura desplegada

Misma arquitectura que P5 (ver [P5/docs/architecture.md](../P5/docs/architecture.md)),
con estos cambios puntuales para la nube:

| Componente P5 (local) | Componente P6 (GKE) |
|---|---|
| Docker Desktop Kubernetes / minikube | **GKE Autopilot**, regional, `us-central1` |
| Imágenes en el daemon local (`sa-platform/<svc>:tag`) | **Artifact Registry**: `us-central1-docker.pkg.dev/sa-platform-202110363/sa-platform/<svc>:tag` |
| Ingress NGINX + `/etc/hosts` → `sa-platform.local` | Ingress NGINX (mismo chart) + Service `LoadBalancer` con IP pública real, host `<IP>.nip.io` (DNS público, sin dominio propio) |
| PVC sin StorageClass explícita → provisioner local | PVC sin StorageClass explícita → **`standard-rwo`** (Persistent Disk balanceado), la StorageClass por defecto de GKE |
| `resourceQuota` dimensionado para ~4GB RAM local | `resourceQuota` ampliado en `P6/helm/values-gke.yaml` (Autopilot ajusta mínimos de recursos por contenedor y consume más cuota) |
| `ms-notifications:1.0.0` | **`ms-notifications:1.0.1`** — corrige un bug real de reconexión a PostgreSQL encontrado al desplegar en la nube (ver sección 12 y [docs/despliegue.md](docs/despliegue.md#8-bug-real-encontrado-y-corregido-reconexión-a-postgresql)) |

La comunicación asíncrona obligatoria (`cronjob-summary` → RabbitMQ →
`ms-notifications` → PostgreSQL) se mantiene sin cambios de diseño.


## 4. Herramientas utilizadas

| Herramienta | Versión real usada |
|---|---|
| Docker | 28.3.2 |
| gcloud CLI | 583.0.0 (`winget install --id Google.CloudSDK`) |
| kubectl | vía `gke-gcloud-auth-plugin` |
| Helm | v4.2.4 (`winget install --id Helm.Helm`) |
| GKE | Autopilot, versión de nodo `1.35.7-gke.1027000` |

## 5. Configuración del proveedor

```bash
gcloud projects create sa-platform-202110363
gcloud billing projects link sa-platform-202110363 --billing-account=<...>
gcloud config set compute/region us-central1
gcloud services enable compute.googleapis.com container.googleapis.com artifactregistry.googleapis.com
```

## 6. Creación del clúster

```bash
gcloud container clusters create-auto sa-platform-cluster \
  --region=us-central1 --release-channel=regular
```

Se eligió **Autopilot** (no Standard) para pagar solo por lo que los Pods
realmente consumen, en vez de reservar VMs completas ociosas — ver
[docs/costos.md](docs/costos.md). Procedimiento completo, con salidas
reales, en [docs/despliegue.md](docs/despliegue.md).

## 7. Configuración del registro

Google Artifact Registry, repositorio Docker `sa-platform` en
`us-central1`. Comandos y verificación en
[docs/despliegue.md](docs/despliegue.md#2-registro-de-contenedores-artifact-registry).

## 8. Publicación de imágenes

Las 7 imágenes (`gateway`, `ms-users`, `ms-products`, `ms-orders`,
`ms-notifications`, `cronjob-heartbeat`, `cronjob-summary`) construidas
desde los Dockerfiles de P5 sin modificar, re-taggeadas y publicadas — ver
[docs/despliegue.md](docs/despliegue.md#3-construir-taggear-y-publicar-las-7-imágenes)
y captura en [docs/evidencias.md](docs/evidencias.md#4-registro-de-contenedores-consola).

## 9. Configuración de Secrets

Mismo patrón que P5: `values.yaml` deja `postgresql.auth.password` /
`rabbitmq.auth.password` vacíos y `required`; las contraseñas reales viven
en `P6/helm/values-secrets.yaml`, generadas localmente con `openssl rand`
(32 caracteres, nunca las de `values.example.yaml`), cubierto por
`P6/.gitignore` — nunca llega a Git. Kubernetes las expone como `Secret`
(`kubectl get secrets -n sa-p5`), nunca como texto plano en el chart.

## 10. Configuración de almacenamiento

Los subcharts de PostgreSQL/RabbitMQ no fijan `storageClassName`: toman
automáticamente `standard-rwo` (Persistent Disk balanceado), la
StorageClass por defecto de GKE — sin tocar el chart. Verificación en
[docs/evidencias.md](docs/evidencias.md#7-almacenamiento-persistente).

## 11. Despliegue

```bash
helm install sa-platform P5/charts/sa-platform -n sa-p5 --create-namespace \
  -f P5/charts/sa-platform/values-prod.yaml \
  -f P6/helm/values-gke.yaml \
  -f P6/helm/values-secrets.yaml
```

Durante el despliegue se encontró y corrigió un **bug real** (no cosmético):
el consumidor asíncrono de `ms-notifications` se quedaba sin conectar a
PostgreSQL por una condición de carrera de timing, específica del arranque
más lento de la nube — con evidencia completa de cómo RabbitMQ acumuló los
mensajes sin perderlos mientras tanto. Detalle en
[docs/despliegue.md](docs/despliegue.md#8-bug-real-encontrado-y-corregido-reconexión-a-postgresql)
y [docs/evidencias.md](docs/evidencias.md#9-comunicación-asíncrona-cronjob--rabbitmq--ms-notifications--postgresql).

## 12. Exposición pública

Ingress NGINX (mismo chart de P5) + Service `LoadBalancer` de GCP →
IP pública real, host resuelto vía `nip.io` (sin comprar dominio).

## 15. Pruebas

Checklist completo de 11 pruebas (clúster, nodos, pods, services, PVC,
gateway, comunicación síncrona/asíncrona, aislamiento de red, endpoint
público, peticiones reales) con resultado real de cada una en
[docs/evidencias.md](docs/evidencias.md).

## 16. Dirección pública utilizada

**`http://34.170.206.2.nip.io`** (IP del LoadBalancer: `34.170.206.2`).

> Esta dirección dejó de responder al finalizar la práctica: los recursos
> se eliminaron deliberadamente el 05/09/2026 (sección 18), como exige el
> enunciado. Toda la evidencia de que funcionó se capturó **antes** de
> eliminar nada — ver sección 16.

## 17. Evidencias

[docs/evidencias.md](docs/evidencias.md) — capturas de la consola de GCP
(clúster, Artifact Registry) + salidas reales de terminal de cada prueba,
incluyendo el incidente real del punto 12 y la verificación de que las
NetworkPolicies sí se aplican en GKE (algo que P5 no pudo verificar en
minikube local).

## 18. Costos

[docs/costos.md](docs/costos.md) — recursos reales creados (clúster
Autopilot, 2 discos `pd-balanced` de 2Gi, 1 Load Balancer, 129 MB en
Artifact Registry) y cómo verificar el gasto real en la consola de
facturación (sin cifras inventadas). Incluye qué se hizo para minimizarlo.

## 19. Eliminación de recursos

[docs/eliminacion.md](docs/eliminacion.md) — procedimiento completo
ejecutado, en orden, con verificación real de que cada recurso (PVC,
discos, LoadBalancer, IP pública, clúster) desapareció.

## 20. Preguntas teóricas

Las 5 preguntas del enunciado, respondidas con base en incidentes reales
del propio despliegue (no copiadas de documentación externa) — ver
[docs/preguntas.md](docs/preguntas.md).

## 21. Conclusiones

- Un clúster administrado resuelve de verdad los puntos débiles de un
  clúster local: dirección pública real, StorageClass real, y (algo que no
  esperábamos) **NetworkPolicies que sí se aplican** — en minikube local
  esto no se pudo verificar por una limitación del CNI anidado en
  Windows/WSL2, documentada en P5.
- El mayor riesgo del despliegue en la nube no fue de infraestructura sino
  de **timing**: un bug real (reconexión sin reintentos a PostgreSQL) que
  nunca se manifestó en local salió a la luz porque GKE tarda más en el
  primer arranque del StatefulSet. Es exactamente la clase de diferencia
  entre entorno local y productivo que la práctica busca hacer evidente.
- Adaptar P5 a GKE no requirió reescribir microservicios ni el chart: solo
  un overlay de valores (`P6/helm/values-gke.yaml`) con las rutas de
  imagen, el host del Ingress y una cuota de recursos ajustada.

---


