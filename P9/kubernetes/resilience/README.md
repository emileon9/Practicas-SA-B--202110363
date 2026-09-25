# Resiliencia ante pérdida de nodo (Práctica 9)

No se crea una carpeta nueva de manifiestos: los tres componentes que pide
la práctica ya existen o se agregaron directamente en los charts de la
Práctica 8, que siguen siendo la fuente de verdad sincronizada por ArgoCD.

| Requisito | Dónde vive | Estado |
|---|---|---|
| `PodDisruptionBudget` | `P8/helm/<servicio>/templates/pdb.yaml` (los 6 servicios ya lo tenían desde P8: `minAvailable: 1`) | Ya existía |
| Réplicas suficientes | `P8/helm/<servicio>/values-prod.yaml` (`replicaCount: 2` en los 5 servicios + gateway) | Ya existía |
| Anti-afinidad | `podAntiAffinity.preferredDuringSchedulingIgnoredDuringExecution` agregado en esta sesión a `P8/helm/{ms-users,ms-products,ms-orders,ms-notifications}/templates/deployment.yaml` y `P8/helm/gateway/templates/rollout.yaml` | Agregado en P9 |
| Readiness/liveness probes | `P8/helm/<servicio>/templates/deployment.yaml` (`startupProbe`/`livenessProbe`/`readinessProbe` sobre `/health`) | Ya existía |

## Por qué "preferred" y no "required"

El clúster de destino real (docker-desktop / minikube) es de **un solo
nodo**. Con `requiredDuringSchedulingIgnoredDuringExecution` la segunda
réplica de cada servicio quedaría en `Pending` para siempre en ese
entorno, porque no hay un segundo nodo al cual asignarla — eso violaría
el objetivo mismo de la práctica (que el servicio siga respondiendo). Se
usa `preferred` con `weight: 100`: en un clúster real de varios nodos
(el de calificación, si tiene más de un nodo) el scheduler sí reparte las
réplicas; en un clúster de un solo nodo, degrada con gracia a
"todas en el mismo nodo" en vez de fallar el despliegue.

## Prueba pendiente

El procedimiento de drenaje de nodo (`kubectl drain`) y la verificación
de que el servicio sigue respondiendo durante el proceso están en
[P9/scripts/node-drain-test.sh](../../scripts/node-drain-test.sh).
PENDIENTE de ejecutar contra un clúster real — ver
[P9/README.md](../../README.md).
