# Arquitectura del proyecto

## Arquitectura utilizada

El proyecto sigue una **arquitectura por capas** (layered architecture) inspirada en Clean Architecture: cada capa tiene una dirección de dependencia hacia adentro (hacia el dominio) y hacia abajo (hacia abstracciones), nunca al revés. El objetivo es que las reglas de negocio y los contratos de la aplicación no dependan de detalles de infraestructura como Express o Prisma.

Capas definidas en `src/`:

```
src/
 ├── config/         (implementado)
 ├── controllers/    (vacío, pendiente)
 ├── services/       (implementado)
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

## Flujo arquitectónico de una solicitud

```
Controller
    ↓
Service Interface
    ↓
Service Implementation
    ↓
Repository Interface
    ↓
Repository Implementation
    ↓
Prisma
    ↓
PostgreSQL
```

Estado actual: implementado de extremo a extremo desde **Service Interface** hasta **PostgreSQL**. `SolicitudOperativaService` (Service Implementation) depende de `ISolicitudOperativaService` (Service Interface, el contrato que expondrá hacia `controllers/`) y recibe `ISolicitudOperativaRepository` (Repository Interface) por constructor, que a su vez resuelve en `SolicitudOperativaRepository` (Repository Implementation) → Prisma → PostgreSQL. El tramo `Controller` es el único que falta por construir.

## Responsabilidad de cada capa

### `config/`

Responsable de la configuración transversal de la aplicación: carga y validación de variables de entorno, e instanciación de recursos compartidos (como el cliente de Prisma). No contiene lógica de negocio ni de HTTP.

- `env.ts`: valida que `DATABASE_URL` exista en el entorno antes de que cualquier otra parte de la app la use. Si falta, lanza un error inmediatamente (*fail fast*) en lugar de fallar más tarde con un mensaje confuso de conexión a base de datos.
- `prisma.client.ts`: crea el único `PrismaClient` de la aplicación (singleton), configurado con el *driver adapter* de PostgreSQL (`@prisma/adapter-pg`), que Prisma 7 exige de forma explícita.

### `interfaces/`

Contiene los contratos (abstracciones) que desacoplan capas entre sí. Es la pieza clave para aplicar Dependency Inversion: las capas de negocio dependerán de estos contratos, nunca de una implementación concreta.

- `solicitudOperativa.repository.interface.ts`: contrato `ISolicitudOperativaRepository` con los cinco métodos de persistencia (`create`, `findAll`, `findById`, `update`, `delete`). No importa nada de Prisma.
- `solicitudOperativa.service.interface.ts`: contrato `ISolicitudOperativaService` con las mismas cinco operaciones a nivel de caso de uso. Su `findById` retorna `Promise<SolicitudOperativa>` (no nullable) en lugar de `Promise<SolicitudOperativa | null>` como el de persistencia, porque a este nivel "no encontrado" es una condición de negocio (se resuelve lanzando `SolicitudNotFoundError`), no un resultado normal de una consulta.

### `repositories/`

Única capa que conoce Prisma y, por lo tanto, la base de datos. Traduce el contrato de `interfaces/` a llamadas concretas del cliente de Prisma, y traduce el resultado de vuelta a los tipos de dominio definidos en `types/`. No valida datos de entrada, no conoce Express, no decide códigos de estado HTTP y no contiene reglas de negocio (por ejemplo, no decide qué significa "solicitud no encontrada" a nivel de aplicación — eso lo decide `services/`, ver más abajo).

- `solicitudOperativa.repository.ts`: implementa `ISolicitudOperativaRepository` usando el `PrismaClient` de `config/prisma.client.ts`.

### `services/`

Contiene los casos de uso y las reglas de negocio de `SolicitudOperativa`, independientes de Express y de Prisma. Es el módulo de alto nivel que decide qué significa "no encontrado", qué datos son válidos y qué transiciones de estado están permitidas — nada de esto vive en `repositories/`.

- `solicitudOperativa.service.ts`: implementa `ISolicitudOperativaService` mediante la clase `SolicitudOperativaService`, que:
  - recibe `ISolicitudOperativaRepository` por constructor (ver la sección "Aplicación de Dependency Injection" más abajo);
  - valida en `create()` que `titulo` y `areaSolicitante` no estén vacíos, que `prioridad` sea un entero entre 1 y 5, y que `costoEstimado` sea mayor que 0, forzando siempre `estado: 'registrada'` como valor inicial;
  - valida en `update()` que la solicitud exista (lanzando `SolicitudNotFoundError` si no) y, si se envía un nuevo `estado`, que la transición sea una de las permitidas en la tabla `TRANSICIONES_VALIDAS` (`registrada → en_proceso`, `en_proceso → completada`, `registrada → cancelada`, `en_proceso → cancelada`);
  - valida en `delete()` que la solicitud exista antes de eliminarla;
  - define tres errores de dominio simples (`SolicitudNotFoundError`, `InvalidSolicitudDataError`, `InvalidEstadoTransitionError`) que extienden `Error`, sin ningún conocimiento de códigos de estado HTTP — esa traducción (por ejemplo, a 404 o 400) quedará a cargo de `controllers/`/`middlewares/`.

### `types/`

DTOs y tipos de dominio propios de la aplicación, independientes del modelo generado por Prisma. Esta separación permite que si el modelo de base de datos cambia de forma. interna (por ejemplo, se agrega una columna puramente técnica), el contrato que ve el resto de la aplicación no tiene por qué cambiar.

- `solicitudOperativa.types.ts`: define `SolicitudOperativa` (entidad de dominio), `CreateSolicitudOperativaDTO` y `UpdateSolicitudOperativaDTO`.

### `controllers/`, `routes/`, `validators/`, `middlewares/`, `utils/` (pendientes)

Existen como archivos vacíos en el scaffold inicial, reservando su ubicación en la arquitectura, pero sin contenido todavía:

- `controllers/`: adaptará HTTP (`req`/`res` de Express) hacia llamadas a `services/`, incluyendo traducir los errores de dominio de `services/` (`SolicitudNotFoundError`, `InvalidSolicitudDataError`, `InvalidEstadoTransitionError`) a códigos de estado HTTP.
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

El proyecto usa **constructor injection** como mecanismo de DI, apoyado en las abstracciones de `interfaces/`. Esto ya está implementado, no solo diseñado: `SolicitudOperativaService` (en `src/services/solicitudOperativa.service.ts`) recibe `ISolicitudOperativaRepository` como parámetro de su constructor, en lugar de instanciar `SolicitudOperativaRepository` internamente:

```typescript
export class SolicitudOperativaService implements ISolicitudOperativaService {
  constructor(private readonly repository: ISolicitudOperativaRepository) {}
```

`SolicitudOperativaService` (módulo de alto nivel, reglas de negocio) depende exclusivamente de `ISolicitudOperativaRepository` (la abstracción definida en `src/interfaces/solicitudOperativa.repository.interface.ts`). En ningún punto de `solicitudOperativa.service.ts` se importa `SolicitudOperativaRepository` (la clase concreta) ni nada de `src/generated/prisma` — toda referencia a Prisma queda contenida en `repositories/` y `config/prisma.client.ts`.

Quien decide qué implementación concreta recibe el constructor es el código que ensambla el servicio (hoy no existe ese punto de ensamblaje porque `app.ts` sigue vacío; cuando se implemente, será algo equivalente a `new SolicitudOperativaService(new SolicitudOperativaRepository())`). `SolicitudOperativaService` en sí mismo no conoce ni decide esa elección.

Esta combinación de Repository Pattern (contrato en `interfaces/`) + Dependency Injection (constructor injection en `services/`) habilita en la práctica:

- **Sustituir el repositorio de Prisma por una implementación in-memory**: cualquier clase que implemente `ISolicitudOperativaRepository` (por ejemplo, una que guarde los datos en un arreglo en memoria) puede pasarse al constructor de `SolicitudOperativaService` sin modificar ni una línea de esa clase.
- **Probar `SolicitudOperativaService` con pruebas unitarias sin una base de datos real**: las reglas de negocio (validaciones de `create`, transiciones de estado en `update`, validación de existencia) pueden verificarse inyectando un repositorio falso, sin levantar PostgreSQL ni Prisma.
- **Mantener el desacoplamiento entre capas**: `services/` no sabe si detrás de `ISolicitudOperativaRepository` hay Prisma, otro ORM, o memoria; `repositories/` no sabe qué reglas de negocio aplica `services/` sobre los datos que persiste.

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
