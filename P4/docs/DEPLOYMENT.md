# Despliegue

## Requisitos

- Docker Desktop (o Docker Engine + Docker Compose v2)
- Puerto 4000 libre en el host

## Despliegue con Docker Compose (recomendado)

Desde la carpeta `P4/`:

```bash
docker compose up --build
```

Esto:

1. Construye las 5 imagenes (`gateway`, `ms-users`, `ms-products`,
   `ms-orders`, `ms-notifications`) usando el `Dockerfile` de cada carpeta.
2. Crea la red bridge `practica4-net`.
3. Levanta primero los 4 microservicios y espera a que cada uno reporte
   `healthy` (via `healthcheck` en `docker-compose.yml`) antes de levantar el
   `gateway` (`depends_on: condition: service_healthy`).
4. Publica **solo** el puerto 4000 (`gateway`) al host.

Para verlo correr en segundo plano: `docker compose up --build -d`.
Para ver logs: `docker compose logs -f`.
Para bajar todo: `docker compose down`.

## Variables de entorno en Docker Compose

Definidas directamente en `docker-compose.yml` (no son secretos, son URLs
internas de red Docker):

```yaml
USERS_SERVICE_URL=http://ms-users:4001
PRODUCTS_SERVICE_URL=http://ms-products:4002
ORDERS_SERVICE_URL=http://ms-orders:4003
NOTIFICATIONS_SERVICE_URL=http://ms-notifications:4004
```

## Healthchecks

| Servicio | Comando de healthcheck |
|---|---|
| ms-users, ms-products | `wget -qO- http://localhost:<puerto>/health` (BusyBox incluido en `node:20-alpine`) |
| ms-orders, ms-notifications | `python -c "import urllib.request; urllib.request.urlopen(...)"` (sin instalar curl extra en la imagen `python:3.12-slim`) |

## Despliegue local sin Docker

Ver seccion "Como ejecutar localmente" en el [README.md](../README.md).

## Verificacion post-despliegue

```bash
curl http://localhost:4000/health
curl http://localhost:4000/api/users/health
curl http://localhost:4000/api/products/health
curl http://localhost:4000/api/orders/health
curl http://localhost:4000/api/notifications/health
```

Diagrama de despliegue: [diagrams/deployment.puml](diagrams/deployment.puml).
