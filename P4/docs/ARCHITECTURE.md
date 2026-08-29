# Arquitectura

## Estilo

Microservicios independientes detras de un API Gateway (patron "Gateway
Routing" / "Backend for Frontend" simplificado, sin BFF real: un solo Gateway
para un solo tipo de cliente).

## Componentes

| Componente | Lenguaje | Rol |
|---|---|---|
| `gateway` | Node.js + TypeScript + Express | Unico punto de entrada externo. Reenvia peticiones (`http-proxy-middleware`) a cada microservicio segun prefijo de ruta (`/api/users`, `/api/products`, `/api/orders`, `/api/notifications`). No contiene logica de negocio. |
| `ms-users` | Node.js + TypeScript + Express + GraphQL | Expone datos de usuarios via REST (`/health`) y GraphQL (`/graphql`, query `users`). |
| `ms-products` | Node.js + TypeScript + Express + GraphQL | Expone datos de productos via REST (`/health`) y GraphQL (`/graphql`, query `products`). |
| `ms-orders` | Python + FastAPI | Expone pedidos via REST (`/health`, `/orders`). |
| `ms-notifications` | Python + FastAPI | Expone notificaciones via REST (`/health`, `/notifications`). |

## Reglas de diseno respetadas

1. **Un unico punto de entrada externo**: solo `gateway` publica puerto al
   host (4000) en `docker-compose.yml`. Los 4 microservicios solo son
   alcanzables dentro de la red Docker `practica4-net`.
2. **Sin acoplamiento entre microservicios**: ningun microservicio importa
   codigo de otro ni le hace peticiones HTTP directamente. Toda la
   composicion ocurre en el Gateway.
3. **Gateway sin logica de negocio**: revisar `gateway/src/app.ts` y
   `gateway/src/routes/*.ts` — solo hay configuracion de middlewares y
   creacion de proxies, ninguna regla de dominio (no hay validaciones de
   pedidos, calculos de precio, etc.).
4. **Datos mock, no base de datos**: los 4 microservicios guardan sus datos
   de prueba en memoria (arrays en TypeScript / Python). No existe un motor
   de base de datos en este sistema todavia, por lo que no se modela un ER
   de persistencia real (ver `docs/diagrams/er.puml` para la aclaracion).

## Flujo de una peticion tipica

```
Cliente -> GET http://localhost:4000/api/orders/orders
        -> Gateway (puerto 4000)
        -> Router "ordersRoutes" (gateway/src/routes/orders.routes.ts)
        -> Proxy HTTP hacia http://ms-orders:4003
        -> FastAPI (ms-orders/app/routers/orders.py) -> orders_service.get_orders()
        <- JSON con 3 pedidos mock
```

## Diagrama

Ver [diagrams/architecture.puml](diagrams/architecture.puml).
