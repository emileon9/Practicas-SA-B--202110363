# Despliegue: de proyecto GCP vacío a plataforma funcionando en GKE

Procedimiento real, ejecutado y verificado el 04-05/09/2026. Reutiliza el
Helm chart de [P5](../../P5/charts/sa-platform) sin modificar su arquitectura
(microservicios, gateway, PostgreSQL, RabbitMQ, CronJobs) — solo se agregan
overlays específicos de la nube en `P6/helm/` y una corrección puntual de un
bug real encontrado al desplegar (sección 8).

Proyecto usado: `sa-platform-202110363` · Región: `us-central1` · Clúster:
`sa-platform-cluster` (GKE Autopilot).

## 0. Prerrequisitos

```powershell
docker --version
gcloud --version   # instalado con: winget install --id Google.CloudSDK
helm version        # instalado con: winget install --id Helm.Helm (v4.2.4)
```

## 1. Cuenta y proyecto de GCP

```bash
gcloud auth login
gcloud billing accounts list          # confirmar que exista una cuenta con OPEN: True
gcloud projects create sa-platform-202110363 --name="sa-platform-202110363"
gcloud config set project sa-platform-202110363
gcloud billing projects link sa-platform-202110363 --billing-account=<ACCOUNT_ID>
gcloud config set compute/region us-central1
gcloud config set compute/zone us-central1-a
gcloud services enable compute.googleapis.com container.googleapis.com artifactregistry.googleapis.com
```

> Nota real de esta práctica: la cuenta institucional (`@ingenieria.usac.edu.gt`)
> tenía la creación de cuentas de facturación bloqueada por política del
> dominio (Google Workspace de USAC). Se resolvió iniciando sesión con una
> cuenta Gmail personal para activar el free trial/créditos y crear el
> proyecto. Si te pasa lo mismo, ese es el motivo más probable.

## 2. Registro de contenedores (Artifact Registry)

```bash
gcloud artifacts repositories create sa-platform \
  --repository-format=docker --location=us-central1 \
  --description="Imagenes de la plataforma sa-platform (P6)"
gcloud auth configure-docker us-central1-docker.pkg.dev --quiet
```

## 3. Construir, taggear y publicar las 7 imágenes

```bash
cd P5
REGISTRY="us-central1-docker.pkg.dev/sa-platform-202110363/sa-platform"
for svc in gateway ms-users ms-products ms-orders ms-notifications; do
  docker build -t "sa-platform/$svc:1.0.0" "services/$svc"
  docker tag "sa-platform/$svc:1.0.0" "$REGISTRY/$svc:1.0.0"
  docker push "$REGISTRY/$svc:1.0.0"
done
docker build -t sa-platform/cronjob-heartbeat:1.0.0 jobs/cronjob-heartbeat
docker build -t sa-platform/cronjob-summary:1.0.0 jobs/cronjob-summary
docker tag sa-platform/cronjob-heartbeat:1.0.0 "$REGISTRY/cronjob-heartbeat:1.0.0"
docker tag sa-platform/cronjob-summary:1.0.0 "$REGISTRY/cronjob-summary:1.0.0"
docker push "$REGISTRY/cronjob-heartbeat:1.0.0"
docker push "$REGISTRY/cronjob-summary:1.0.0"

gcloud artifacts docker images list us-central1-docker.pkg.dev/sa-platform-202110363/sa-platform --include-tags
```

## 4. Crear el clúster GKE (Autopilot, mínimo 2 nodos)

```bash
gcloud container clusters create-auto sa-platform-cluster \
  --project=sa-platform-202110363 --region=us-central1 --release-channel=regular

gcloud components install gke-gcloud-auth-plugin --quiet
gcloud container clusters get-credentials sa-platform-cluster --region=us-central1

kubectl get nodes
kubectl cluster-info
kubectl get namespaces
```

Autopilot arranca con 1 solo nodo (clúster vacío); escala automáticamente a
2+ nodos al recibir la carga real de la plataforma (paso 7). No se
considera cumplido el "mínimo 2 nodos" hasta verificarlo con la plataforma
desplegada.

## 5. Ingress Controller (infraestructura del clúster, no de la plataforma)

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace \
  --set controller.service.type=LoadBalancer

kubectl get svc -n ingress-nginx ingress-nginx-controller -w   # esperar EXTERNAL-IP
```

Con la IP pública asignada (ej. `34.170.206.2`), arma el host del Ingress
usando el servicio gratuito `nip.io` (sin comprar dominio ni tocar
`/etc/hosts`): `<IP>.nip.io`.

## 6. Overlay de GKE (`P6/helm/`)

Dos archivos, gitignored el de secretos:

- **`values-gke.yaml`** (versionado): apunta `image.repository` de los 5
  microservicios + 2 CronJobs a Artifact Registry, fija `ingress.host` a
  `<IP>.nip.io`, y amplía el `resourceQuota` del namespace (el de
  `values.yaml` está dimensionado para un clúster local de ~4GB RAM; en GKE
  Autopilot cada contenedor consume algo más de cuota por los mínimos que
  Autopilot ajusta, y un rolling update normal necesita crear el pod nuevo
  antes de tumbar el viejo — con la cuota local esto bloqueaba cualquier
  `helm upgrade` con `exceeded quota`, verificado al desplegar el punto 8).
- **`values-secrets.yaml`** (NO versionado, ver `P6/.gitignore`): contraseñas
  de PostgreSQL/RabbitMQ generadas localmente con `openssl rand`, nunca las
  de `values.example.yaml`.

```bash
helm dependency update P5/charts/sa-platform
helm lint P5/charts/sa-platform
```

## 7. Instalar la plataforma

```bash
helm install sa-platform P5/charts/sa-platform -n sa-p5 --create-namespace \
  -f P5/charts/sa-platform/values-prod.yaml \
  -f P6/helm/values-gke.yaml \
  -f P6/helm/values-secrets.yaml

kubectl get pods -n sa-p5 -w        # esperar a que todo quede Running/Ready
kubectl get pvc -n sa-p5            # Bound
kubectl get nodes                    # ahora si, verificar >= 2 nodos con carga real
```

## 8. Bug real encontrado y corregido: reconexión a PostgreSQL

Al desplegar, `ms-notifications` (consumidor asíncrono de RabbitMQ) se
quedó sin procesar mensajes: su hilo de fondo intentaba conectar a
PostgreSQL **una sola vez**, sin reintentos (`app/services/summary_consumer.py`).
En GKE, el primer arranque de PostgreSQL (adjuntar el PVC + `initdb`) tardó
más que en minikube local, el intento hizo timeout, y el hilo murió para
siempre — sin loguearlo, porque el logging de Python no estaba configurado.
Detalle completo con evidencia en [evidencias.md](evidencias.md#9-comunicación-asíncrona-cronjob--rabbitmq--ms-notifications--postgresql).

Corrección aplicada (`services/ms-notifications/app/services/summary_consumer.py`
y `app/main.py`): reintentos con backoff en la conexión a PostgreSQL +
`logging.basicConfig`. Republicada como `1.0.1`:

```bash
docker build -t sa-platform/ms-notifications:1.0.1 P5/services/ms-notifications
docker tag sa-platform/ms-notifications:1.0.1 "$REGISTRY/ms-notifications:1.0.1"
docker push "$REGISTRY/ms-notifications:1.0.1"
# P6/helm/values-gke.yaml: ms-notifications.image.tag: "1.0.1"
helm upgrade sa-platform P5/charts/sa-platform -n sa-p5 \
  -f P5/charts/sa-platform/values-prod.yaml \
  -f P6/helm/values-gke.yaml \
  -f P6/helm/values-secrets.yaml
```

## 9. Verificación final

```bash
kubectl get pods -n sa-p5
kubectl get svc -n sa-p5
kubectl get ingress -n sa-p5
kubectl get hpa -n sa-p5
kubectl get networkpolicy -n sa-p5
kubectl get secrets -n sa-p5

curl http://<IP>.nip.io/health
curl http://<IP>.nip.io/api/orders/orders
```

Checklist completo de pruebas y resultados reales en
[evidencias.md](evidencias.md).

## 10. Ciclo de vida (upgrade ya demostrado en el paso 8)

El `helm upgrade` del paso 8 ya demuestra el ciclo de vida completo
(cambio de versión de imagen + ajuste de `resourceQuota`, rollout sin
downtime verificado con `kubectl rollout status`). Procedimiento de
eliminación al finalizar en [eliminacion.md](eliminacion.md).
