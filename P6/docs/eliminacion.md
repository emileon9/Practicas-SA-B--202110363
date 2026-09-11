# Eliminación de recursos

Ejecutada el 05/09/2026, inmediatamente después de capturar toda la
evidencia en [evidencias.md](evidencias.md). Orden de eliminación pensado
para que cada paso libere el recurso que factura, sin dejar nada huérfano.

## 1. Release de la plataforma

```
$ helm uninstall sa-platform -n sa-p5
release "sa-platform" uninstalled
```

Borra los 5 microservicios, gateway, CronJobs, StatefulSets de
PostgreSQL/RabbitMQ, Services, NetworkPolicies, Secrets, ConfigMap, HPA y
RBAC. **No borra los PVC** (protección deliberada de Kubernetes para los
volúmenes de un StatefulSet):

```
$ kubectl get pvc -n sa-p5
NAME                   STATUS   VOLUME        CAPACITY   STORAGECLASS
data-sa-postgresql-0   Bound    pvc-ed4b...   2Gi        standard-rwo
data-sa-rabbitmq-0     Bound    pvc-97c1...   2Gi        standard-rwo
```

## 2. PVC y namespace de la plataforma

```
$ kubectl delete pvc --all -n sa-p5
persistentvolumeclaim "data-sa-postgresql-0" deleted
persistentvolumeclaim "data-sa-rabbitmq-0" deleted

$ kubectl delete namespace sa-p5
namespace "sa-p5" deleted
```

Verificación de que los discos reales (no solo el objeto de Kubernetes)
desaparecieron:

```
$ gcloud compute disks list --project=sa-platform-202110363
Listed 0 items.
```

## 3. Ingress Controller (libera el LoadBalancer y la IP pública)

```
$ helm uninstall ingress-nginx -n ingress-nginx
release "ingress-nginx" uninstalled

$ kubectl delete namespace ingress-nginx
namespace "ingress-nginx" deleted
```

Verificación de que el forwarding rule y la IP pública `34.170.206.2`
desaparecieron:

```
$ gcloud compute forwarding-rules list --project=sa-platform-202110363
Listed 0 items.

$ curl --max-time 5 http://34.170.206.2.nip.io/health
(sin respuesta — HTTP 000, correcto: el LoadBalancer ya no existe)
```

## 4. Clúster GKE completo

```
$ gcloud container clusters delete sa-platform-cluster --region=us-central1 --quiet
Deleting cluster sa-platform-cluster...
done.
Deleted [https://container.googleapis.com/v1/projects/sa-platform-202110363/zones/us-central1/clusters/sa-platform-cluster].
```

## 5. Recursos que se conservaron deliberadamente

| Recurso | Decisión | Motivo |
|---|---|---|
| Repositorio Artifact Registry `sa-platform` (7 imágenes, 129 MB) | Se conserva | Costo mínimo (probablemente dentro de la capa gratuita); permite redesplegar sin reconstruir imágenes si hace falta una re-demostración |
| Proyecto GCP `sa-platform-202110363` | Se conserva | Borrar el clúster ya detiene el costo real; el proyecto en sí no genera cargos por existir vacío |

## 6. Verificación final de que no queda nada facturando

```
$ gcloud container clusters list --project=sa-platform-202110363
(vacio)

$ gcloud compute disks list --project=sa-platform-202110363
Listed 0 items.

$ gcloud compute forwarding-rules list --project=sa-platform-202110363
Listed 0 items.

$ gcloud compute instances list --project=sa-platform-202110363
Listed 0 items.

$ gcloud artifacts repositories list --project=sa-platform-202110363
REPOSITORY   FORMAT  LOCATION     SIZE (MB)
sa-platform  DOCKER  us-central1  123.481
```

Confirmado: clúster, discos, LoadBalancer/IP pública e instancias en cero.
Solo queda el repositorio de Artifact Registry (123.5 MB), conservado a
propósito (ver sección 5). Pendiente: revisar
`console.cloud.google.com/billing` en los días siguientes para confirmar
que el consumo diario vuelve a cero.
