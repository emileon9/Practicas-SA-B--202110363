# Practica 4 - Sistema de Gestion de Pedidos (Microservicios)

Sistema basado en microservicios para la Practica 4 de Software Avanzado (USAC).
Simula una tienda simple: usuarios, productos, pedidos y notificaciones, cada uno
como un microservicio independiente, expuestos a traves de un API Gateway unico.

## 1. Descripcion del sistema

Temática: **gestion de pedidos**. Un cliente externo solo habla con el **API
Gateway** (puerto 4000). El Gateway enruta cada peticion al microservicio
correspondiente. Los microservicios no se comunican entre si directamente (no
hay imports cruzados ni llamadas service-to-service); toda la orquestacion
externa pasa por el Gateway.

Por ahora todos los microservicios usan **datos mock en memoria** (no hay base
de datos). Esto es intencional: la practica pide demostrar la arquitectura de
microservicios, no un modelo de persistencia.

## 2. Arquitectura

```
                        ┌─────────────┐
   Cliente (curl/Postman) ──────────▶ │  API Gateway │  :4000  (unico puerto publicado)
                        └──────┬──────┘
                               │ /api/*
        ┌──────────────┬───────┼────────────────┬──────────────────┐
        ▼              ▼                        ▼                  ▼
   ms-users:4001  ms-products:4002        ms-orders:4003     ms-notifications:4004
   (Node/TS)      (Node/TS)                (Python/FastAPI)   (Python/FastAPI)
   REST+GraphQL   REST+GraphQL             REST               REST
```

Ver diagrama completo en [docs/diagrams/architecture.puml](docs/diagrams/architecture.puml).

## 3. Microservicios

| Servicio | Responsabilidad | Endpoints |
|---|---|---|
| `gateway` | Unico punto de entrada, enruta, no tiene logica de negocio | `GET /health`, `/api/*` (proxy) |
| `ms-users` | Consulta de usuarios | `GET /health`, `POST /graphql` (query `users`) |
| `ms-products` | Consulta de productos | `GET /health`, `POST /graphql` (query `products`) |
| `ms-orders` | Consulta de pedidos | `GET /health`, `GET /orders` |
| `ms-notifications` | Consulta de notificaciones | `GET /health`, `GET /notifications` |

## 4. Tecnologias utilizadas

- **Node.js 20 + TypeScript + Express 5** → `gateway`, `ms-users`, `ms-products`
- **GraphQL** (`graphql` + `graphql-http`) → `ms-users`, `ms-products`
- **Python 3.12 + FastAPI + Uvicorn** → `ms-orders`, `ms-notifications`
- **Docker / Docker Compose** para orquestacion local

Dos lenguajes distintos (Node/TypeScript y Python) ✅.

## 5. Puertos

| Servicio | Puerto interno | Publicado al host |
|---|---|---|
| gateway | 4000 | Si (`localhost:4000`) |
| ms-users | 4001 | No (solo red interna de Docker) |
| ms-products | 4002 | No |
| ms-orders | 4003 | No |
| ms-notifications | 4004 | No |

## 6. Como instalar

Requiere Node.js 20+, Python 3.12+ y Docker Desktop.

```bash
# Servicios Node
cd gateway && npm install
cd ../ms-users && npm install
cd ../ms-products && npm install

# Servicios Python
cd ../ms-orders && python -m venv .venv && ./.venv/Scripts/pip install -r requirements.txt
cd ../ms-notifications && python -m venv .venv && ./.venv/Scripts/pip install -r requirements.txt
```

Copiar cada `.env.example` a `.env` en cada servicio si se ejecuta localmente
(fuera de Docker).

## 7. Como ejecutar localmente (sin Docker)

En 5 terminales distintas:

```bash
cd ms-users && npm run dev            # :4001
cd ms-products && npm run dev         # :4002
cd ms-orders && ./.venv/Scripts/uvicorn app.main:app --port 4003
cd ms-notifications && ./.venv/Scripts/uvicorn app.main:app --port 4004
cd gateway && npm run dev             # :4000
```

## 8. Como ejecutar con Docker

```bash
docker compose up --build
```

Esto construye y levanta los 5 contenedores en una sola red (`practica4-net`).
Solo el Gateway queda accesible desde el host, en `http://localhost:4000`.

Para bajar todo: `docker compose down`.

## 9. Endpoints (a traves del Gateway)

```
GET  http://localhost:4000/health
GET  http://localhost:4000/api/users/health
GET  http://localhost:4000/api/products/health
GET  http://localhost:4000/api/orders/health
GET  http://localhost:4000/api/notifications/health
GET  http://localhost:4000/api/orders/orders
GET  http://localhost:4000/api/notifications/notifications
POST http://localhost:4000/api/users/graphql
POST http://localhost:4000/api/products/graphql
```

Detalle completo de contratos en [docs/API.md](docs/API.md) y en la coleccion
Postman [docs/postman_collection.json](docs/postman_collection.json).

## 10. Consultas GraphQL

**ms-users** (directo `:4001/graphql` o via Gateway `:4000/api/users/graphql`):
```graphql
query {
  users {
    id
    name
    email
  }
}
```

**ms-products** (directo `:4002/graphql` o via Gateway `:4000/api/products/graphql`):
```graphql
query {
  products {
    id
    name
    price
  }
}
```

Mas detalle en [docs/GRAPHQL.md](docs/GRAPHQL.md).

## 11. Variables de entorno

Cada servicio tiene su propio `.env.example` (sin secretos):

- `gateway/.env.example` → `PORT`, `USERS_SERVICE_URL`, `PRODUCTS_SERVICE_URL`,
  `ORDERS_SERVICE_URL`, `NOTIFICATIONS_SERVICE_URL`, `AUTH_SERVICE_URL` (vacio,
  preparado para la Practica 2)
- `ms-users/.env.example`, `ms-products/.env.example` → `PORT`
- `ms-orders/.env.example`, `ms-notifications/.env.example` → `PORT`

En Docker Compose las URLs internas se configuran por nombre de servicio
(`http://ms-users:4001`, etc.) directamente en `docker-compose.yml`.

## 12. Arquitectura de comunicacion

- El cliente externo **solo** conoce el Gateway.
- El Gateway reenvia (`http-proxy-middleware`) cada request a la URL interna
  del microservicio correspondiente, resuelta por nombre de servicio de Docker
  (`ms-users`, `ms-products`, `ms-orders`, `ms-notifications`).
- Los microservicios **no se llaman entre si**; cada uno es independiente y
  aislado (una sola red Docker, sin acoplamiento de codigo).
- Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) y
  [docs/diagrams/architecture.puml](docs/diagrams/architecture.puml).

## 13. Autenticacion (integracion futura con Practica 2)

Este proyecto **no reimplementa** la autenticacion. Existe una estructura
preparada en el Gateway para conectar el servicio real desarrollado en la
Practica 2 (`P2/backend`, JWT en cookie HttpOnly):

- `gateway/src/middleware/auth.middleware.ts` → middleware que hoy deja pasar
  todas las peticiones (`next()`), con un `TODO(P2-integration)` explicito.
- `gateway/src/config/env.ts` → variable `authServiceUrl` (vacia por defecto,
  sin secretos).
- `gateway/.env.example` → `AUTH_SERVICE_URL=`

**Pendiente de conectar con el servicio de autenticacion de la Practica 2.**
Cuando se integre, debe respetarse que P2 usa JWT en cookie HttpOnly (no
`Authorization: Bearer`), ver `P2/backend/src/services/JwtService.ts` y
`P2/backend/src/middlewares/authenticate.ts`.

## 14. Estructura del proyecto

```
P4/
├── gateway/            (Node+TS+Express) - Gateway
├── ms-users/           (Node+TS+Express+GraphQL)
├── ms-products/        (Node+TS+Express+GraphQL)
├── ms-orders/          (Python+FastAPI)
├── ms-notifications/   (Python+FastAPI)
├── docs/               (documentacion + diagramas + coleccion Postman)
├── docker-compose.yml
└── README.md
```

Cada servicio Node sigue: `src/{config,controllers,services,routes,graphql,
middleware}` + `app.ts` + `server.ts`. Cada servicio Python sigue:
`app/{routers,services}` + `main.py` + `config.py`. Ningun microservicio
importa codigo de otro (aislamiento real, no solo de carpetas).

## 15. Principios SOLID (evidencia real en el codigo)

- **SRP (responsabilidad unica)**:
  - [`gateway/src/services/proxy.service.ts:11`](gateway/src/services/proxy.service.ts) →
    `createServiceProxy()` solo sabe crear un proxy HTTP hacia un target; no
    conoce rutas ni logica de negocio.
  - [`gateway/src/middleware/auth.middleware.ts:13`](gateway/src/middleware/auth.middleware.ts) →
    unica responsabilidad: el punto de extension de autenticacion.
  - [`ms-users/src/services/users.service.ts:13`](ms-users/src/services/users.service.ts) →
    el acceso a datos de usuarios esta separado del controller REST
    (`controllers/users.controller.ts`) y del resolver GraphQL
    (`graphql/resolvers.ts`); ambos reutilizan la misma funcion `getUsers()`.

- **OCP (abierto/cerrado)**:
  - [`gateway/src/routes/users.routes.ts:5`](gateway/src/routes/users.routes.ts) y
    sus hermanos (`products.routes.ts`, `orders.routes.ts`,
    `notifications.routes.ts`) son archivos independientes montados en
    `gateway/src/routes/index.ts`. Agregar un quinto microservicio significa
    **agregar** un archivo nuevo, no modificar los existentes.

- **DIP (inversion de dependencias)**:
  - Las rutas del Gateway no conocen host/puerto reales de cada
    microservicio: dependen de la abstraccion `env` (`gateway/src/config/env.ts`),
    que lee la configuracion desde variables de entorno. El modulo de alto
    nivel (rutas) no depende del detalle de bajo nivel (URL concreta).

No se crearon clases o patrones adicionales (factories, singletons, DI
containers) solo para "demostrar SOLID": los tres puntos anteriores son
consecuencia natural de mantener responsabilidades separadas, no
abstracciones artificiales agregadas después.

## 16. Documentacion adicional

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [docs/API.md](docs/API.md)
- [docs/GRAPHQL.md](docs/GRAPHQL.md)
- [docs/diagrams/](docs/diagrams/) (`architecture.puml`, `deployment.puml`, `er.puml`)
- [docs/postman_collection.json](docs/postman_collection.json)


