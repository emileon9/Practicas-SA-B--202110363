# Arquitectura del proyecto

## Arquitectura utilizada

El proyecto sigue una **arquitectura por capas** (layered architecture) inspirada en Clean Architecture: cada capa tiene una dirección de dependencia hacia adentro (hacia el dominio) y hacia abajo (hacia abstracciones), nunca al revés. El objetivo es que las reglas de negocio y los contratos de la aplicación no dependan de detalles de infraestructura como Express o Prisma.

Capas definidas en `src/`:

```
src/
 ├── config/         (implementado)
 ├── controllers/    (vacío, pendiente)
 ├── services/       (vacío, pendiente)
 ├── repositories/   (implementado)
 ├── routes/         (vacío, pendiente)
 ├── middlewares/    (vacío, pendiente)
 ├── validators/     (vacío, pendiente)
 ├── interfaces/     (implementado)
 ├── utils/          (vacío, pendiente)
 ├── types/          (implementado)
 ├── generated/prisma/  (autogenerado por Prisma, no editar a mano)
 ├── app.ts          (vacío, pendiente)
 └── server.ts       (vacío, pendiente)
```

## Responsabilidad de cada capa

### `config/`

Responsable de la configuración transversal de la aplicación: carga y validación de variables de entorno, e instanciación de recursos compartidos (como el cliente de Prisma). No contiene lógica de negocio ni de HTTP.

- `env.ts`: valida que `DATABASE_URL` exista en el entorno antes de que cualquier otra parte de la app la use. Si falta, lanza un error inmediatamente (*fail fast*) en lugar de fallar más tarde con un mensaje confuso de conexión a base de datos.
- `prisma.client.ts`: crea el único `PrismaClient` de la aplicación (singleton), configurado con el *driver adapter* de PostgreSQL (`@prisma/adapter-pg`), que Prisma 7 exige de forma explícita.

### `interfaces/`

Contiene los contratos (abstracciones) que desacoplan capas entre sí. Es la pieza clave para aplicar Dependency Inversion: las capas de negocio dependerán de estos contratos, nunca de una implementación concreta.

- `solicitudOperativa.repository.interface.ts`: contrato `ISolicitudOperativaRepository` con los cinco métodos de persistencia (`create`, `findAll`, `findById`, `update`, `delete`). No importa nada de Prisma.
- `solicitudOperativa.service.interface.ts`: reservado para el contrato de casos de uso; actualmente vacío, se definirá al implementar `services/`.

### `repositories/`

Única capa que conoce Prisma y, por lo tanto, la base de datos. Traduce el contrato de `interfaces/` a llamadas concretas del cliente de Prisma, y traduce el resultado de vuelta a los tipos de dominio definidos en `types/`. No valida datos de entrada, no conoce Express, no decide códigos de estado HTTP y no contiene reglas de negocio (por ejemplo, no decide qué significa "solicitud no encontrada" a nivel de aplicación — eso quedará a cargo de `services/`).

- `solicitudOperativa.repository.ts`: implementa `ISolicitudOperativaRepository` usando el `PrismaClient` de `config/prisma.client.ts`.

### `types/`

DTOs y tipos de dominio propios de la aplicación, independientes del modelo generado por Prisma. Esta separación permite que si el modelo de base de datos cambia de forma. interna (por ejemplo, se agrega una columna puramente técnica), el contrato que ve el resto de la aplicación no tiene por qué cambiar.

- `solicitudOperativa.types.ts`: define `SolicitudOperativa` (entidad de dominio), `CreateSolicitudOperativaDTO` y `UpdateSolicitudOperativaDTO`.

### `controllers/`, `services/`, `routes/`, `validators/`, `middlewares/`, `utils/` (pendientes)

Existen como archivos vacíos en el scaffold inicial, reservando su ubicación en la arquitectura, pero sin contenido todavía:

- `controllers/`: adaptará HTTP (`req`/`res` de Express) hacia llamadas a `services/`.
- `services/`: contendrá los casos de uso y las reglas de negocio (por ejemplo, validar el rango 1-5 de `prioridad` como regla de aplicación, o decidir transiciones válidas de `estado`).
- `routes/`: mapeará verbo HTTP + path hacia un método de controller.
- `validators/`: validación de forma de los datos de entrada (independiente de las reglas de negocio).
- `middlewares/`: manejo centralizado de errores y de rutas no encontradas.
- `utils/`: helpers genéricos sin significado de negocio.

## Decisiones de diseño

**1. `costoEstimado` se expone como `string`, no como `number` ni como `Decimal` de Prisma.**
El campo es `Decimal` en PostgreSQL/Prisma para evitar errores de redondeo en moneda. Convertirlo a `number` de JavaScript en el límite del repositorio perdería precisión; exponer directamente el tipo `Decimal` de Prisma acoplaría `types/` (y por tanto cualquier capa futura) al runtime de Prisma. La solución adoptada en `solicitudOperativa.repository.ts` es convertir con `.toString()` al salir de la base de datos, manteniendo `types/` completamente libre de imports de Prisma.

**2. El cliente de Prisma se genera dentro de `src/` (`src/generated/prisma`), no en la raíz del proyecto.**
El `tsconfig.json` define `"rootDir": "./src"`. Si el cliente se generara fuera de `src/` (como en la configuración original del proyecto), TypeScript fallaría al compilar con el error `TS6059: File is not under 'rootDir'` en cuanto `repositories/` lo importara. Se ajustó `generator client { output = "../src/generated/prisma" }` en `prisma/schema.prisma` para resolver esto de raíz.

**3. `PrismaClient` requiere un *driver adapter* explícito.**
A partir de Prisma 7, el generador `prisma-client` no incluye un motor de consultas embebido por defecto; `PrismaClientOptions` exige un `adapter` (ver `src/generated/prisma/internal/prismaNamespace.ts`, comentario: *"A driver adapter is required unless you connect through Prisma Accelerate"*). Por eso `config/prisma.client.ts` instala y usa `@prisma/adapter-pg` sobre `pg`.

**4. Sistema de módulos: CommonJS.**
El `tsconfig.json` original traía `"module": "nodenext"` (ESM estricto), que exige extensión `.js` explícita en todos los imports relativos aun tratándose de archivos `.ts`. Se cambió a `"module": "commonjs"` con `"esModuleInterop": true` para eliminar esa fricción en un proyecto académico con Express.

## Aplicación de Dependency Injection

El proyecto usa **constructor injection** como mecanismo de DI, apoyado en las abstracciones de `interfaces/`. Hoy esto está preparado pero no completado: `SolicitudOperativaRepository` ya declara explícitamente que implementa `ISolicitudOperativaRepository`:

```typescript
export class SolicitudOperativaRepository implements ISolicitudOperativaRepository {
```

El paso pendiente (próxima fase, `services/`) es que la clase de servicio reciba una instancia de `ISolicitudOperativaRepository` por constructor, en vez de instanciar `SolicitudOperativaRepository` directamente:

```typescript
// Patrón que se aplicará en services/ (aún no implementado):
class SolicitudOperativaService {
  constructor(private readonly repository: ISolicitudOperativaRepository) {}
}
```

Esto permitirá, en pruebas unitarias, inyectar una implementación falsa de `ISolicitudOperativaRepository` sin tocar Prisma ni una base de datos real.

## Separación entre dominio y persistencia

El modelo generado por Prisma (`src/generated/prisma/*`) y la entidad de dominio (`src/types/solicitudOperativa.types.ts`) son **tipos distintos y no intercambiables**. El puente entre ambos es la función `toDomain` definida dentro de `src/repositories/solicitudOperativa.repository.ts`:

```typescript
function toDomain(record: PrismaSolicitudOperativa): SolicitudOperativa {
  return {
    id: record.id,
    titulo: record.titulo,
    areaSolicitante: record.areaSolicitante,
    prioridad: record.prioridad,
    costoEstimado: record.costoEstimado.toString(),
    estado: record.estado,
  };
}
```

Ninguna capa fuera de `repositories/` importa nada de `src/generated/prisma`. Esto significa que si en el futuro se reemplazara Prisma por otro ORM, únicamente `repositories/` (y `config/prisma.client.ts`) tendrían que cambiar — `interfaces/`, `types/`, y las capas futuras de `services/`/`controllers/` permanecerían intactas.
