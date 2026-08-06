# Base de datos

## PostgreSQL

El proyecto usa PostgreSQL como motor de base de datos, declarado en `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
}
```

La cadena de conexión **no** se define dentro de `schema.prisma`, sino en `prisma.config.ts` (patrón de configuración de Prisma 7), que a su vez la lee de la variable de entorno `DATABASE_URL`:

```typescript
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
```

En tiempo de ejecución de la aplicación (no del CLI de Prisma), esa misma variable es validada por `src/config/env.ts` y usada por `src/config/prisma.client.ts` para construir el *driver adapter* de conexión:

```typescript
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });
```

## Prisma ORM

**Versión:** Prisma 7 (`prisma@7.9.1`, `@prisma/client@7.9.1`).

**Generador:** el proyecto usa el generador `prisma-client` (no el clásico `prisma-client-js`), con salida a una ruta personalizada dentro de `src/`:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}
```

Esto genera el cliente en `src/generated/prisma/` en lugar de `node_modules/.prisma/client`. Se eligió esa ubicación (dentro de `src/`) para que el cliente generado quede bajo el `rootDir` de TypeScript y se pueda compilar junto con el resto del código fuente.

**Driver adapter:** a diferencia de versiones anteriores de Prisma, el generador `prisma-client` de Prisma 7 no incluye un motor de consultas embebido por defecto — requiere un *driver adapter* explícito. Este proyecto usa `@prisma/adapter-pg` (basado en el driver `pg` de node-postgres) para conectarse a PostgreSQL.

**Comandos relevantes** (ver `package.json`):

- `npm run prisma:generate` → `prisma generate`
- `npm run prisma:migrate` → `prisma migrate dev`

## Modelo `SolicitudOperativa`

Definido en `prisma/schema.prisma`:

```prisma
model SolicitudOperativa {
  id              Int             @id @default(autoincrement())
  titulo          String          @db.VarChar(200)
  areaSolicitante String          @map("area_solicitante") @db.VarChar(100)
  prioridad       Int             @db.SmallInt
  costoEstimado   Decimal         @map("costo_estimado") @db.Decimal(12, 2)
  estado          EstadoSolicitud @default(registrada)

  @@map("solicitudes_operativas")
}
```

### Tabla `solicitudes_operativas`

El modelo se mapea a la tabla `solicitudes_operativas` (`@@map`) siguiendo la convención SQL de nombres en snake_case, mientras que el modelo de Prisma/TypeScript usa camelCase — esta es una decisión de diseño explícita para que el código de la aplicación (y el JSON de la futura API) use nombres idiomáticos en TypeScript sin dejar de tener una tabla con nombres SQL convencionales.

### Campos

| Campo (Prisma/TS) | Columna (DB) | Tipo | Notas |
|---|---|---|---|
| `id` | `id` | `Int` (PK, autoincrement) | Clave primaria autogenerada. |
| `titulo` | `titulo` | `VarChar(200)` | Límite explícito a nivel de base de datos como defensa adicional ante entradas sin cota. |
| `areaSolicitante` | `area_solicitante` | `VarChar(100)` | Mapeado con `@map` de camelCase a snake_case. |
| `prioridad` | `prioridad` | `SmallInt` | Se espera un rango de 1 a 5; ese rango **no se valida a nivel de esquema** — es responsabilidad de la capa `validators/` (pendiente) validarlo antes de llegar al repositorio. |
| `costoEstimado` | `costo_estimado` | `Decimal(12, 2)` | Precisión fija de 2 decimales para evitar errores de redondeo en moneda. En el dominio de la aplicación (`src/types/solicitudOperativa.types.ts`) se expone como `string`, no como `number`, para no perder precisión (ver `docs/ARCHITECTURE.md`). |
| `estado` | `estado` | `EstadoSolicitud` (enum) | Valor por defecto: `registrada`. |

### Enum `EstadoSolicitud`

```prisma
enum EstadoSolicitud {
  registrada
  en_proceso
  completada
  cancelada
}
```

Representa los cuatro estados válidos de una solicitud operativa. Prisma lo materializa como un tipo `ENUM` nativo de PostgreSQL, lo que garantiza a nivel de base de datos que no se pueda persistir un valor de `estado` fuera de esos cuatro. El generador `prisma-client` expone este enum en `src/generated/prisma/enums.ts` como un objeto constante (`EstadoSolicitud`) más su tipo asociado; la entidad de dominio en `src/types/solicitudOperativa.types.ts` define su propia versión — un tipo unión de los mismos cuatro literales — para no depender directamente del código generado por Prisma:

```typescript
export type EstadoSolicitud = 'registrada' | 'en_proceso' | 'completada' | 'cancelada';
```
