# Mapeo de la entrega contra la rúbrica del PDF

Este documento existe para que, al calificar, sea inmediato encontrar
dónde está la evidencia de cada criterio — cita textual del PDF
(`0780_Practica_6_2S2026.pdf`) + dónde vive la prueba en este repositorio.

## 8.1 Requisitos para optar a la calificación

| Requisito (texto del PDF) | Cumple | Dónde verificarlo |
|---|---|---|
| "Calificación de práctica 5 y repositorio de la misma" | ✅ | [P5/](../../P5) completo, commit `680f8d3 p5 terminada` |
| "El despliegue deberá realizarse en un clúster de Kubernetes administrado, no local" | ✅ | GKE Autopilot `sa-platform-cluster`, región `us-central1` — [evidencias.md §1](evidencias.md#1-clúster-gke-consola) |
| "El sistema deberá ser accesible desde internet mediante una dirección pública" | ✅ | `http://34.170.206.2.nip.io` — [evidencias.md §5-6](evidencias.md#5-exposición-pública-ip-del-loadbalancer--ingress) |
| "Realizar la documentación en formato Markdown" | ✅ | Todo este repositorio (`.md`), sin Word/PDF propios |
| "Debe de contar con comunicación asíncrona entre microservicios y apigateway" | ✅ | `cronjob-summary` → RabbitMQ → `ms-notifications` → PostgreSQL — [evidencias.md §9](evidencias.md#9-comunicación-asíncrona-cronjob--rabbitmq--ms-notifications--postgresql) (nota: el flujo asíncrono conecta los microservicios entre sí, no gateway↔MS directamente — el gateway solo tiene comunicación síncrona por diseño heredado de P4/P5; el async obligatorio es el pipeline CronJob→broker→MS ya presente desde P5) |

## 8.2 Resumen de puntuaciones

### 1. Habilidades (40%)

| Criterio | Pts | Satisfactorio exige (texto del PDF) | Evidencia en este repo |
|---|---|---|---|
| 1.1 Creación y configuración del clúster | 10 | "El clúster administrado está creado con al menos 2 nodos y kubectl conectado correctamente al contexto remoto." | [evidencias.md §1-2](evidencias.md): captura de consola + `kubectl get nodes` mostrando 3 nodos `Ready` con la carga real desplegada, `kubectl cluster-info` conectado al control plane remoto |
| 1.2 Publicación de imágenes en el registro | 10 | "Las imágenes están publicadas en un registro accesible y el clúster las descarga sin errores." | [evidencias.md §4](evidencias.md#4-registro-de-contenedores-consola): captura de Artifact Registry con las 7 imágenes; los 10 pods `Running` (§3) confirman que el clúster las descargó sin `ImagePullBackOff` |
| 1.3 Despliegue de la plataforma en la nube | 10 | "Todos los componentes de la práctica anterior se encuentran en ejecución dentro del clúster de la nube." | [evidencias.md §3](evidencias.md#3-pods-en-ejecución): gateway (3), ms-users/ms-products/ms-orders/ms-notifications (2 c/u), PostgreSQL y RabbitMQ (StatefulSets), 2 CronJobs — todos `Running`/`Completed` |
| 1.4 Exposición pública del sistema | 10 | "El sistema responde desde internet mediante una dirección IP o un dominio público." | [evidencias.md §6](evidencias.md#6-peticiones-exitosas-desde-internet): 5 rutas reales con `200 OK` vía `curl` contra la IP pública, más un `404` real (no timeout) para ruta inexistente |

**Subtotal habilidades: 40/40 con evidencia real.**

### 2. Conocimiento (60%)

| Criterio | Pts | Satisfactorio exige (texto del PDF) | Evidencia en este repo |
|---|---|---|---|
| 2.1 Adaptación a la nube (almacenamiento, red y secretos) | 15 | "Almacenamiento con la StorageClass del proveedor, secretos gestionados fuera del repositorio y red correctamente configurada." | Almacenamiento: [evidencias.md §7](evidencias.md#7-almacenamiento-persistente) (`standard-rwo`, PVC `Bound`). Secretos: [evidencias.md §8](evidencias.md#8-secrets-gestionados-fuera-del-repositorio) (`values-secrets.yaml` gitignored, nunca impreso). Red: [evidencias.md §10](evidencias.md#10-extra-aislamiento-de-red-con-networkpolicy-funciona-en-la-nube) — NetworkPolicies verificadas con pod intruso bloqueado + pod autorizado conectado |
| 2.2 Evidencias de funcionamiento | 15 | "Presenta capturas de la consola del proveedor, de los pods en ejecución y de peticiones exitosas realizadas desde internet." | Consola: `screenshots/01-cluster-gke.png`, `screenshots/04-artifact-registry.png`. Pods: [evidencias.md §3](evidencias.md#3-pods-en-ejecución). Peticiones desde internet: [evidencias.md §6](evidencias.md#6-peticiones-exitosas-desde-internet) |
| 2.3 Preguntas teóricas | 20 | "Respuestas completas, analíticas y con propias palabras a las preguntas planteadas." | [preguntas.md](preguntas.md) — las 5 respuestas citan incidentes reales de este despliegue específico (bloqueo de facturación institucional, escalado de nodos, bug de reconexión a PostgreSQL, NetworkPolicy en GKE vs minikube, deduplicación de capas en Artifact Registry), no definiciones genéricas copiadas |
| 2.4 Gestión de costos y eliminación de recursos | 10 | "Documenta el costo aproximado del despliegue y el procedimiento de eliminación de los recursos utilizados." | Costos: [costos.md](costos.md) (recursos reales + cómo verificar el gasto exacto en consola, sin inventar cifras). Eliminación: [eliminacion.md](eliminacion.md) — las 6 fases ejecutadas y verificadas, con confirmación final de que clúster/discos/LB/instancias quedaron en cero |

**Subtotal conocimiento: 60/60 con evidencia real** (asumiendo que quien
califica esté de acuerdo con la calidad de las respuestas teóricas, que es
la única parte inherentemente subjetiva).

## Nota sobre la entrega

El repositorio tiene un commit (`7ccd107 subida de practica 6`) que ya
incluye una versión de esta carpeta `P6/`. Los archivos listados arriba
(`README.md`, `docs/despliegue.md`, `docs/evidencias.md`, `docs/costos.md`,
`docs/eliminacion.md`, `docs/preguntas.md`, `docs/rubrica.md`, las 2
capturas, y las últimas correcciones a `helm/values-gke.yaml`) se
terminaron de escribir **después** de ese commit, dentro de la ventana de
tiempo permitida de trabajo, pero no se pudieron subir a Git porque el
plazo de entrega (medianoche) ya había pasado. Quedan completos en el
disco local por si hay otra vía de entrega — ver conversación para el
detalle de en qué momento se hizo cada commit real.
