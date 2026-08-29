# Despliegue: de clúster vacío a plataforma funcionando

Todos los comandos son reproducibles tal cual, en orden, desde un clúster
recién creado. El único `kubectl apply -f` de todo el procedimiento es para
instalar el Ingress Controller (una herramienta de infraestructura del
clúster, no un recurso de la plataforma); **la plataforma en sí se
instala, actualiza y revierte exclusivamente con `helm install` / `helm
upgrade` / `helm rollback`**.

## 0. Prerrequisitos

```bash
docker --version
kubectl version --client
helm version          # debe ser 3.x
```

Activar Kubernetes en Docker Desktop: **Settings → Kubernetes → Enable
Kubernetes → Apply & Restart** (no hay equivalente por CLI en este Docker
Desktop). Verificar:

```bash
kubectl config get-contexts
kubectl cluster-info
```

## 1. Ingress Controller y metrics-server (infraestructura del clúster)

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl patch deployment metrics-server -n kube-system --type='json' \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'

kubectl wait --for=condition=available --timeout=120s -n ingress-nginx deployment/ingress-nginx-controller
kubectl wait --for=condition=available --timeout=120s -n kube-system deployment/metrics-server
```

Resolver el host del Ingress (PowerShell, una sola vez, como administrador):

```powershell
Add-Content -Path C:\Windows\System32\drivers\etc\hosts -Value "127.0.0.1 sa-platform.local"
```

## 2. Construir las imágenes (Docker Desktop comparte el daemon con su
   propio clúster de Kubernetes: no hace falta registry ni `kind load`)

```bash
cd P5
for svc in gateway ms-users ms-products ms-orders ms-notifications; do
  docker build -t "sa-platform/$svc:1.0.0" "services/$svc"
done
docker build -t sa-platform/cronjob-heartbeat:1.0.0 jobs/cronjob-heartbeat
docker build -t sa-platform/cronjob-summary:1.0.0   jobs/cronjob-summary
docker images | grep sa-platform
```

## 3. Resolver dependencias del chart

```bash
cd P5/charts/sa-platform
helm dependency update .
helm lint .
```

## 4. Configurar secretos locales (nunca versionados)

```bash
cp values.example.yaml values-secrets.yaml
# editar values-secrets.yaml con contraseñas reales de desarrollo
```

## 5. Instalar la plataforma (el chart crea el namespace `sa-p5`)

```bash
helm install sa-platform . -n sa-p5 \
  -f values-dev.yaml -f values-secrets.yaml
```

> `--create-namespace` NO se usa a propósito: `templates/namespace.yaml`
> crea el namespace como parte del propio release (Namespace es de los
> primeros tipos de recurso que Helm aplica en cada instalación, antes que
> cualquier objeto namespaced), tal como exige el enunciado ("deberá ser
> creado por el propio chart, no de forma manual").

## 6. Verificar

```bash
kubectl get all -n sa-p5
kubectl get pods -n sa-p5 -w        # esperar a que todo quede Running/Ready
kubectl get pvc -n sa-p5            # Bound
kubectl get ingress -n sa-p5
kubectl get hpa -n sa-p5
kubectl get networkpolicy -n sa-p5
kubectl get cronjobs -n sa-p5
kubectl get secrets -n sa-p5

curl http://sa-platform.local/health
curl http://sa-platform.local/api/orders/orders
```

## 7. Ciclo de vida: versión 2, upgrade y rollback (obligatorio)

Subir la versión del chart (`Chart.yaml`: `version: 1.1.0`) y, por ejemplo,
cambiar `gateway.image.tag` en `values-dev.yaml` o cualquier otro valor
observable, luego:

```bash
helm upgrade sa-platform . -n sa-p5 -f values-dev.yaml -f values-secrets.yaml
kubectl rollout status deployment/gateway -n sa-p5    # debe completar sin downtime
helm history sa-platform -n sa-p5                      # revision 2 visible

# Revertir a la revision anterior
helm rollback sa-platform 1 -n sa-p5
helm history sa-platform -n sa-p5                      # revision 3 = rollback a 1
kubectl rollout status deployment/gateway -n sa-p5
```

Guardar la salida completa de ambos `helm history` en `docs/evidence.md`.

## 8. Desinstalar (limpieza)

```bash
helm uninstall sa-platform -n sa-p5
kubectl delete namespace sa-p5   # el namespace no se borra solo con helm uninstall
```
