# Despliegue: de clúster vacío a plataforma funcionando

Procedimiento real, ejecutado y verificado el 29/08/2026 sobre
`minikube --driver=docker --cni=calico` en Windows. El único
`kubectl apply -f`/`minikube addons enable` de todo el procedimiento es
para infraestructura del clúster (Ingress Controller, metrics-server,
Calico) — **la plataforma `sa-platform` en sí se instala, actualiza y
revierte exclusivamente con `helm install` / `helm upgrade` / `helm
rollback`**.

> Por qué minikube y no Docker Desktop Kubernetes: se probó primero con
> Docker Desktop Kubernetes (más rápido de activar), pero su clúster no
> trae un CNI con soporte de NetworkPolicy. Con minikube + Calico las
> NetworkPolicies sí se definen y verifican correctamente, aunque el
> *enforcement* en este entorno concreto (Windows + driver docker anidado)
> tampoco terminó de aplicar — ver la limitación documentada en
> [networking.md](networking.md) y [evidence.md](evidence.md#5-bloqueo-por-networkpolicy--limitación-de-entorno-documentada).

## 0. Prerrequisitos

```powershell
docker --version
kubectl version --client
helm version          # 3.20.0
minikube version       # 1.38.1
```

## 1. Clúster local con Calico

```powershell
minikube start --driver=docker --cni=calico --cpus=4 --memory=6144
minikube addons enable ingress
minikube addons enable metrics-server
kubectl get pods -n kube-system -l k8s-app=calico-node   # debe quedar Running/Ready
```

`minikube addons enable ingress` instala ingress-nginx en el namespace
`ingress-nginx` (coincide con `networkPolicy.ingressControllerNamespace`
del chart); `metrics-server` habilita el HPA sin parches manuales de TLS,
a diferencia de Docker Desktop Kubernetes.

## 2. Construir las imágenes y cargarlas en minikube

minikube con `--driver=docker` **no** comparte el daemon de Docker del
host (a diferencia de Docker Desktop Kubernetes): hay que construir y
luego cargar cada imagen explícitamente con `minikube image load`.

```powershell
cd P5
foreach ($svc in "gateway","ms-users","ms-products","ms-orders","ms-notifications") {
  docker build -t "sa-platform/${svc}:1.0.0" "services/$svc"
}
docker build -t sa-platform/cronjob-heartbeat:1.0.0 jobs/cronjob-heartbeat
docker build -t sa-platform/cronjob-summary:1.0.0   jobs/cronjob-summary

foreach ($img in "sa-platform/gateway:1.0.0","sa-platform/ms-users:1.0.0","sa-platform/ms-products:1.0.0","sa-platform/ms-orders:1.0.0","sa-platform/ms-notifications:1.0.0","sa-platform/cronjob-heartbeat:1.0.0","sa-platform/cronjob-summary:1.0.0") {
  minikube image load $img
}
```

Si vas a usar `values-dev.yaml` (tag `dev`), construye y carga también las
mismas imágenes con `:dev` en vez de `:1.0.0` (o usa `docker tag ...:1.0.0 ...:dev`
antes de `minikube image load`).

## 3. Resolver dependencias del chart

```powershell
cd P5/charts/sa-platform
helm dependency update .
helm lint .
```

> Nota sobre RabbitMQ: Bitnami movió la imagen `bitnami/rabbitmq` a su
> registro de pago desde agosto 2025; el chart ya trae el override a
> `bitnamilegacy/rabbitmq` (mismo tag, gratis) en `values.yaml` — no hace
> falta hacer nada adicional, pero si `sa-rabbitmq-0` queda en
> `ErrImagePull`, es la primera causa a revisar.

## 4. Configurar secretos locales (nunca versionados)

```powershell
Copy-Item values.example.yaml values-secrets.yaml
# editar values-secrets.yaml con contraseñas reales de desarrollo
```

## 5. Instalar la plataforma

```powershell
helm install sa-platform . -n sa-p5 --create-namespace -f values-dev.yaml -f values-secrets.yaml
```

> **Por qué `--create-namespace` y no un template propio.** Se intentó
> primero que el propio chart creara el namespace vía
> `templates/namespace.yaml` (sin `--create-namespace`), como sugiere
> literalmente el enunciado. En la práctica, `helm install` necesita el
> namespace destino ya existente para su propio tracking del release
> *antes* de aplicar cualquier plantilla — con un namespace inexistente
> falla con `namespaces "sa-p5" not found`, verificado repetidas veces.
> Combinar `--create-namespace` CON un template de `Namespace` propio
> tampoco funciona (choca con `already exists`, porque el namespace creado
> por el flag no queda con las anotaciones de ownership de Helm que el
> template intenta volver a crear). La solución que sí funciona de forma
> reproducible: `--create-namespace` únicamente, sin `templates/namespace.yaml`
> en el chart. Sigue siendo un único comando de Helm, sin ningún
> `kubectl create namespace` manual.

## 6. Verificar

```powershell
kubectl get pods -n sa-p5 -w        # esperar a que todo quede Running/Ready (~2-3 min: postgresql y rabbitmq tardan mas)
kubectl get pvc -n sa-p5            # Bound
kubectl get ingress -n sa-p5
kubectl get hpa -n sa-p5
kubectl get networkpolicy -n sa-p5
kubectl get cronjobs -n sa-p5
kubectl get secrets -n sa-p5
```

Probar el Ingress. En Windows, con el driver `docker` de minikube, la IP
del clúster (`minikube ip`) normalmente **no** es alcanzable directo desde
el host sin `minikube tunnel` (requiere una terminal aparte y privilegios
de admin); la forma mas simple de probar sin eso es un port-forward al
Ingress Controller:

```powershell
kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 18080:80
```

Y en otra terminal:

```powershell
curl.exe -s --resolve sa-platform.local:18080:127.0.0.1 http://sa-platform.local:18080/health
curl.exe -s --resolve sa-platform.local:18080:127.0.0.1 http://sa-platform.local:18080/api/orders/orders
```

(Alternativa con `minikube tunnel` corriendo: agregar
`<minikube ip> sa-platform.local` a `C:\Windows\System32\drivers\etc\hosts`
y pegar directo `http://sa-platform.local/health`.)

## 7. Ciclo de vida: versión 2, upgrade y rollback (obligatorio)

```powershell
# Chart.yaml: version 1.0.0 -> 1.1.0
# values-dev.yaml: gateway.replicaCount 1 -> 2 (cambio observable)

helm upgrade sa-platform . -n sa-p5 -f values-dev.yaml -f values-secrets.yaml
kubectl get pods -n sa-p5 -l app=gateway     # debe verse 2 replicas
helm history sa-platform -n sa-p5             # revision 2, chart 1.1.0

helm rollback sa-platform 1 -n sa-p5
kubectl get pods -n sa-p5 -l app=gateway     # debe volver a 1 replica
helm history sa-platform -n sa-p5             # revision 3 = "Rollback to 1"
```

Resultado real, ver [evidence.md](evidence.md#1-ciclo-de-vida-con-helm-install-upgrade-rollback).

## 8. Desinstalar (limpieza)

```powershell
helm uninstall sa-platform -n sa-p5
kubectl delete namespace sa-p5   # el namespace no se borra solo con helm uninstall
minikube stop                     # o "minikube delete" para borrar el cluster completo
```
