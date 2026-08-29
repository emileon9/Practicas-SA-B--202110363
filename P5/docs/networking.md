# Red: Ingress y NetworkPolicies

## Ingress (unica puerta de entrada)

`templates/ingress.yaml` crea un unico `Ingress` (`sa-platform-ingress`) que
enruta **todo** el trafico externo hacia el Service `gateway-svc` (puerto
`.Values.gateway.containerPort`, 4000). Ningun otro Service del namespace
tiene una regla de Ingress ni usa `NodePort`/`LoadBalancer` — todos son
`ClusterIP` (ver cada `templates/service.yaml` de los subcharts y las
`Service` que crean las dependencias `postgresql`/`rabbitmq`).

Requiere un Ingress Controller NGINX corriendo en el cluster (namespace
`ingress-nginx`). Con Docker Desktop Kubernetes:

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml
kubectl get pods -n ingress-nginx -w
```

> Nota: esta es la UNICA vez que se usa `kubectl apply -f` en todo el
> procedimiento, y es para instalar el Ingress Controller en si mismo (una
> herramienta de infraestructura del cluster, no un recurso de la
> plataforma). La plataforma `sa-platform` se instala exclusivamente con
> `helm install`/`helm upgrade` (ver [deployment.md](deployment.md)).

Como el Ingress usa `host: sa-platform.local` (parametrizable en
`values.yaml` / `values-dev.yaml` / `values-prod.yaml`), hay que resolver
ese nombre hacia la IP del Ingress Controller. En Docker Desktop
Kubernetes, el controller queda accesible en `127.0.0.1`:

```powershell
# PowerShell como administrador, una sola vez:
Add-Content -Path C:\Windows\System32\drivers\etc\hosts -Value "127.0.0.1 sa-platform.local"
```

## NetworkPolicies (`templates/networkpolicy.yaml`)

Todas usan `policyTypes: [Ingress]` unicamente (no restringen egress, asi
que DNS y las conexiones salientes de cada pod siguen funcionando sin una
policy adicional para `kube-dns`).

| NetworkPolicy | Protege (podSelector) | Permite ingreso desde |
|---|---|---|
| `allow-ingress-to-gateway` | `app: gateway` | namespace `ingress-nginx` |
| `allow-gateway-to-ms-users` | `app: ms-users` | `app: gateway` |
| `allow-gateway-to-ms-products` | `app: ms-products` | `app: gateway` |
| `allow-gateway-to-ms-orders` | `app: ms-orders` | `app: gateway` |
| `allow-gateway-to-ms-notifications` | `app: ms-notifications` | `app: gateway` |
| `allow-consumers-to-postgresql` | pods de PostgreSQL (Bitnami) | `app in (ms-notifications, cronjob-heartbeat, cronjob-summary)` |
| `allow-consumers-to-rabbitmq` | pods de RabbitMQ (Bitnami) | `app in (ms-notifications, cronjob-summary)` |

Como Kubernetes aplica NetworkPolicies de forma **deny-by-default una vez
que un pod es seleccionado por al menos una policy de tipo Ingress**, y
ninguna de las reglas de arriba autoriza, por ejemplo, `ms-users -> ms-orders`
o un pod cualquiera -> PostgreSQL, ese trafico lateral queda bloqueado.

## Evidencia del bloqueo (obligatoria)

Procedimiento para demostrar que el aislamiento realmente funciona, lanzando
un pod "atacante" sin ninguna de las etiquetas autorizadas:

```bash
kubectl run intruder --rm -it --restart=Never -n sa-p5 \
  --image=busybox:1.36 --labels="app=intruder" -- sh
```

Dentro del pod:

```sh
# Debe FALLAR (timeout) - PostgreSQL solo acepta ms-notifications/cronjobs
wget -T 5 -qO- sa-postgresql.sa-p5.svc.cluster.local:5432

# Debe FALLAR (timeout) - RabbitMQ solo acepta ms-notifications/cronjob-summary
wget -T 5 -qO- sa-rabbitmq.sa-p5.svc.cluster.local:5672

# Debe FALLAR (timeout) - ms-orders solo acepta al gateway
wget -T 5 -qO- ms-orders.sa-p5.svc.cluster.local:4003/health
```

Los tres comandos deben terminar en `wget: download timed out` (o
`connection refused`, dependiendo del CNI). Guardar la salida de la
terminal como evidencia en `docs/evidence.md`.

Para contrastar, desde un pod SI autorizado (por ejemplo exec dentro de
`ms-notifications`), el mismo `wget` hacia PostgreSQL/RabbitMQ debe
responder (o al menos no dar timeout de red):

```bash
kubectl exec -n sa-p5 deploy/ms-notifications -- \
  wget -T 5 -qO- sa-postgresql.sa-p5.svc.cluster.local:5432
```
