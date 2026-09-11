# Preguntas teóricas

Respondidas con base en lo que realmente encontramos al desplegar
`sa-platform` en GKE (ver [despliegue.md](despliegue.md) y
[evidencias.md](evidencias.md) para el detalle de cada incidente citado
aquí).

## 1. ¿Qué es un clúster de Kubernetes administrado y qué diferencias tiene frente a uno local?

Un clúster administrado es uno donde el proveedor de nube opera el
**control plane** (API server, etcd, scheduler, controller-manager) y, en
el caso de un modo como GKE Autopilot, también los nodos: los aprovisiona,
los parcha, los escala y los reemplaza sin que el usuario tenga acceso
directo a esas VMs. En nuestro despliegue esto se notó de forma muy
concreta: cuando quisimos listar las instancias de Compute Engine detrás
del clúster (`gcloud compute instances list`), la respuesta fue "0 items"
— los nodos existen (`kubectl get nodes` sí los muestra) pero viven en un
proyecto/tenant que Google administra, no en el nuestro.

La diferencia más importante frente a un clúster local (en P5 usamos
Docker Desktop Kubernetes y luego minikube) no es solo "está en la nube",
sino el **comportamiento real bajo carga**. Dos ejemplos que vivimos:

- **Escalado de nodos real**: el clúster Autopilot arrancó con 1 solo nodo
  (nada corriendo todavía) y escaló automáticamente a 3 nodos apenas
  desplegamos la plataforma completa (10 pods de servicios + PostgreSQL +
  RabbitMQ). En local, minikube siempre es un único nodo fijo — no hay
  decisión de scheduling real entre máquinas distintas.
- **NetworkPolicies que sí se aplican**: en P5, documentamos que las
  NetworkPolicies **no se podían verificar** en minikube local (un pod sin
  las etiquetas autorizadas igual lograba conectarse a PostgreSQL, por una
  limitación del CNI anidado en Windows/WSL2). En GKE, con el mismo chart
  y las mismas policies, lanzamos un pod "intruso" y las tres conexiones
  (PostgreSQL, RabbitMQ, ms-orders) fallaron como se esperaba — mientras
  que un pod sí autorizado (`ms-notifications`) conectó sin problema. Es
  decir: el diseño de seguridad de red era correcto desde P5, pero
  **solo un clúster real con un CNI de producción (Dataplane V2/Cilium en
  este caso) lo hace cumplir de verdad**.

En resumen: un clúster local sirve para desarrollar y probar lógica de
aplicación, pero no reproduce fielmente el comportamiento de red,
almacenamiento ni escalado que sí se observa en un clúster administrado.

## 2. ¿Qué es un Service de tipo LoadBalancer y cómo lo implementa el proveedor de nube?

`LoadBalancer` es uno de los tipos de `Service` de Kubernetes (junto con
`ClusterIP` y `NodePort`) que le pide al **cloud-controller-manager** del
proveedor que aprovisione un balanceador de carga real, fuera del clúster,
con una IP pública, y lo apunte hacia los pods que ese Service selecciona.
Es una abstracción: el YAML es igual en cualquier proveedor (`type:
LoadBalancer`), pero lo que pasa "detrás" depende de cada nube.

En nuestro caso no le pusimos `type: LoadBalancer` directamente al Service
del gateway (que sigue siendo `ClusterIP`, igual que en P5), sino al
Service del **Ingress Controller** (`ingress-nginx`), con:

```bash
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --set controller.service.type=LoadBalancer
```

Apenas se creó ese Service, GCP aprovisionó automáticamente (sin que
nosotros tocáramos la consola) un **Network Load Balancer** regional: un
forwarding rule con una IP pública real, verificable con
`gcloud compute forwarding-rules list` (nos asignó `34.170.206.2`). Ese
único balanceador reenvía todo el tráfico HTTP hacia el Ingress Controller,
que a su vez decide, según el `Ingress` de la plataforma, hacia qué Service
interno (`gateway`) mandar cada petición. Es más barato y más simple que
ponerle un `LoadBalancer` a cada uno de los 5 microservicios: un solo
balanceador facturable en vez de cinco.

## 3. ¿Qué es un registro de contenedores y por qué es necesario para desplegar en la nube?

Un registro de contenedores es un servidor donde se publican imágenes
Docker con un nombre y un tag, para que cualquier máquina con permiso pueda
descargarlas (`docker pull`) sin necesitar el código fuente ni reconstruir
nada. Es necesario para desplegar en la nube porque **los nodos del
clúster no tienen acceso al daemon de Docker de nuestra laptop**: en P5,
con Docker Desktop Kubernetes, el mismo daemon que construye la imagen es
el que corre los pods, así que un tag local como `sa-platform/gateway:1.0.0`
funciona sin más. En GKE, cada nodo es una VM aparte que solo sabe hacer
`docker pull` desde algún registro accesible por red — nuestra laptop
apagada o desconectada no le sirve de nada al clúster.

Por eso el flujo real fue: construir la imagen igual que siempre
(`docker build`), re-taggearla con la ruta completa del registro
(`us-central1-docker.pkg.dev/sa-platform-202110363/sa-platform/gateway:1.0.0`)
y hacer `docker push`, autenticando Docker contra Artifact Registry con
`gcloud auth configure-docker`. Cuando el chart de Helm referencia esa
misma ruta en `image.repository`, el `kubelet` de cada nodo la descarga por
su cuenta al crear el pod.

Un detalle que no esperábamos: el repositorio completo con las 7 imágenes
pesa **123 MB**, mucho menos que la suma de las 7 imágenes individuales
(~1.4 GB) — Artifact Registry deduplica las capas base compartidas
(`node:20-alpine`, `python:3.12-slim`) entre las imágenes, así que no paga
ni transfiere lo mismo siete veces.

## 4. ¿Qué componentes del clúster administra el proveedor y cuáles siguen siendo responsabilidad del estudiante?

Con GKE Autopilot, Google administra: el control plane completo (API
server, etcd, scheduler), el aprovisionamiento y parchado de los nodos, el
CNI/dataplane de red (Dataplane V2), el `StorageClass` por defecto y su
integración con los discos (`standard-rwo` → Persistent Disk), y
componentes de sistema como `metrics-server` (ya venía instalado, a
diferencia de minikube donde había que instalarlo manualmente).

Lo que siguió siendo responsabilidad nuestra, y donde de hecho encontramos
los problemas reales de esta práctica:

- **El contenido de las imágenes y sus bugs**: el clúster no tiene forma de
  saber que `summary_consumer.py` no reintentaba la conexión a PostgreSQL.
  Ese bug (y su corrección) fue enteramente nuestro.
- **El dimensionamiento de recursos**: el `resourceQuota` que traía el
  chart (pensado para un clúster local de ~4GB) bloqueó un `helm upgrade`
  normal en GKE con `exceeded quota`, porque Autopilot ajusta hacia arriba
  los mínimos de CPU/memoria por contenedor. Nadie del lado de Google avisa
  de esto — hay que leer el evento `FailedCreate` y decidir subir la cuota.
- **Los Secrets y las credenciales**: Google no genera ni protege nuestras
  contraseñas de PostgreSQL/RabbitMQ; eso vive en `values-secrets.yaml`,
  generado y resguardado por nosotros, fuera del repositorio.
- **Las políticas de red (NetworkPolicy) y RBAC**: el CNI de Google las
  hace *cumplir*, pero el diseño de quién puede hablar con quién lo
  definimos nosotros en el chart, heredado de P5.
- **La gestión de costos y la eliminación de recursos**: el proveedor no
  borra nada solo. Si no ejecutamos nosotros el procedimiento de
  eliminación (ver [eliminacion.md](eliminacion.md)), el clúster sigue
  facturando indefinidamente.

## 5. ¿Qué costos genera el despliegue realizado y cómo podrían reducirse?

Documentado con detalle en [costos.md](costos.md), sin inventar cifras en
dólares (verificables en la consola de facturación). En resumen, lo que
realmente generó costo mientras el clúster existió: el clúster GKE
Autopilot (cuota de gestión + cómputo real consumido por los pods — en
el pico, cerca de 1.5 vCPU y 2.1 GiB solicitados), 2 discos persistentes
`pd-balanced` de 2Gi cada uno, y 1 Load Balancer externo (forwarding rule
+ IP pública) facturado por hora **independientemente del tráfico real**
que recibiera. El repositorio de Artifact Registry (123 MB) es
prácticamente insignificante frente a esos otros tres.

Cómo se redujo el costo en esta práctica:

- Se usó **Autopilot en vez de Standard**: se paga por lo que los pods
  realmente piden, no por 2-3 VMs completas reservadas 24/7 aunque estén
  ociosas la mayor parte del tiempo.
- Réplicas y límites de recursos modestos (`values-prod.yaml` de P5, 2-3
  réplicas por servicio, no más).
- Discos pequeños (2Gi), suficientes para la duración de la práctica.
- Sin IP estática reservada: se usó la IP efímera que el propio
  balanceador asigna, evitando un cargo adicional por una IP reservada y
  no utilizada.
- Y, sobre todo, **eliminar el clúster y el Load Balancer en cuanto se
  terminó de capturar la evidencia** (sección 18 del README) — es la
  única acción que realmente detiene el cobro por hora; dejar el clúster
  "por si acaso" habría sido el error de costo más caro y menos
  justificado de toda la práctica.
