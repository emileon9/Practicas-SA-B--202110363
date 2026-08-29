# API - Contratos REST

Todas las rutas se acceden a traves del Gateway en `http://localhost:4000`.
(Los puertos internos 4001-4004 solo son accesibles dentro de la red Docker;
si se ejecuta localmente sin Docker si son accesibles directamente.)

## Gateway

### `GET /health`
Health check del propio Gateway (no proxy).

```json
{ "status": "ok", "service": "gateway" }
```

## Usuarios (`ms-users`, via `/api/users/*`)

### `GET /api/users/health`
```json
{ "status": "ok", "service": "ms-users" }
```

### `POST /api/users/graphql`
Ver [GRAPHQL.md](GRAPHQL.md).

## Productos (`ms-products`, via `/api/products/*`)

### `GET /api/products/health`
```json
{ "status": "ok", "service": "ms-products" }
```

### `POST /api/products/graphql`
Ver [GRAPHQL.md](GRAPHQL.md).

## Pedidos (`ms-orders`, via `/api/orders/*`)

### `GET /api/orders/health`
```json
{ "status": "ok", "service": "ms-orders" }
```

### `GET /api/orders/orders`
Devuelve la lista de pedidos de prueba.

```json
[
  { "id": 1, "userId": 1, "product": "Teclado mecanico", "quantity": 1, "status": "pending" },
  { "id": 2, "userId": 2, "product": "Mouse inalambrico", "quantity": 2, "status": "shipped" },
  { "id": 3, "userId": 3, "product": "Monitor 24 pulgadas", "quantity": 1, "status": "delivered" }
]
```

## Notificaciones (`ms-notifications`, via `/api/notifications/*`)

### `GET /api/notifications/health`
```json
{ "status": "ok", "service": "ms-notifications" }
```

### `GET /api/notifications/notifications`
Devuelve la lista de notificaciones de prueba.

```json
[
  { "id": 1, "userId": 1, "message": "Tu pedido #1 esta pendiente de confirmacion", "read": false },
  { "id": 2, "userId": 2, "message": "Tu pedido #2 fue enviado", "read": false },
  { "id": 3, "userId": 3, "message": "Tu pedido #3 fue entregado", "read": true }
]
```

## Coleccion Postman

Ver [postman_collection.json](postman_collection.json) — importable
directamente en Postman, incluye los 4 health checks del Gateway, las dos
consultas GraphQL y las dos listas REST.
