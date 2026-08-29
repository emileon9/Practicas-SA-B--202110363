# GraphQL

Implementado en **ms-users** y **ms-products**, usando `graphql` +
`graphql-http` (librerias minimas, sin un framework tipo Apollo, ya que el
alcance es una sola query por servicio).

## ms-users

- Schema: [`ms-users/src/graphql/schema.ts`](../ms-users/src/graphql/schema.ts)
- Resolvers: [`ms-users/src/graphql/resolvers.ts`](../ms-users/src/graphql/resolvers.ts)
- Endpoint: `POST /graphql` (directo `:4001`, o via Gateway `POST /api/users/graphql`)

Schema:
```graphql
type User {
  id: Int!
  name: String!
  email: String!
}

type Query {
  users: [User!]!
}
```

Como probar (directo al microservicio):
```bash
curl -X POST http://localhost:4001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { users { id name email } }"}'
```

Como probar (via Gateway):
```bash
curl -X POST http://localhost:4000/api/users/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { users { id name email } }"}'
```

Respuesta esperada:
```json
{
  "data": {
    "users": [
      { "id": 1, "name": "Ana Lopez", "email": "ana.lopez@example.com" },
      { "id": 2, "name": "Carlos Ramirez", "email": "carlos.ramirez@example.com" },
      { "id": 3, "name": "Maria Fernandez", "email": "maria.fernandez@example.com" }
    ]
  }
}
```

## ms-products

- Schema: [`ms-products/src/graphql/schema.ts`](../ms-products/src/graphql/schema.ts)
- Resolvers: [`ms-products/src/graphql/resolvers.ts`](../ms-products/src/graphql/resolvers.ts)
- Endpoint: `POST /graphql` (directo `:4002`, o via Gateway `POST /api/products/graphql`)

Schema:
```graphql
type Product {
  id: Int!
  name: String!
  price: Float!
}

type Query {
  products: [Product!]!
}
```

Como probar (via Gateway):
```bash
curl -X POST http://localhost:4000/api/products/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { products { id name price } }"}'
```

Respuesta esperada:
```json
{
  "data": {
    "products": [
      { "id": 1, "name": "Teclado mecanico", "price": 45.99 },
      { "id": 2, "name": "Mouse inalambrico", "price": 19.5 },
      { "id": 3, "name": "Monitor 24 pulgadas", "price": 129 }
    ]
  }
}
```

Ambas queries fueron probadas manualmente (directo a cada microservicio y a
traves del Gateway) durante el desarrollo de la Fase 4 y Fase 5/8.
