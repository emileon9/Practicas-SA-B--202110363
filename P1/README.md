# Solicitudes Operativas API

## Información general

**Nombre del proyecto:** `solicitudes-operativas-api`

**Descripción:** API REST para la gestión de Solicitudes Operativas, desarrollada como práctica universitaria aplicando Clean Architecture, Clean Code, principios SOLID y las recomendaciones OWASP Top 10.

**Objetivo del backend:** exponer un conjunto de endpoints que permitan registrar, consultar, actualizar y eliminar solicitudes operativas, así como cambiar su estado de forma controlada, manteniendo una separación estricta entre el protocolo HTTP, las reglas de negocio y la persistencia en base de datos.

**Tecnologías utilizadas:**

- Node.js (v22)
- TypeScript (v7)
- Express (v5)
- Prisma ORM (v7)
- PostgreSQL
- Zod (validación de entrada)

> Estado actual del proyecto: las capas `interfaces/`, `repositories/`, `services/`, `validators/`, `types/` y `config/` ya están implementadas. Las capas `controllers/`, `routes/`, `middlewares/` y `utils/` existen como archivos vacíos (scaffold) pendientes de implementación.

## Instalación y ejecución

### Requisitos previos

- Node.js 22 o superior
- PostgreSQL en ejecución (local o remoto)
- npm

### Instalación de dependencias

```bash
npm install
```

### Configuración del archivo `.env`

Crear un archivo `.env` en la raíz del proyecto con la cadena de conexión a PostgreSQL:

```
DATABASE_URL="postgresql://usuario:password@localhost:5432/nombre_db"
```

`DATABASE_URL` es requerida: `src/config/env.ts` valida su presencia y lanza un error si no está definida antes de que el resto de la aplicación arranque.

### Scripts disponibles

| Script | Comando | Descripción |
|---|---|---|
| `dev` | `tsx watch src/server.ts` | Levanta el servidor en modo desarrollo con recarga automática |
| `build` | `tsc -p tsconfig.json` | Compila TypeScript a `dist/` |
| `start` | `node dist/server.js` | Ejecuta la build compilada |
| `prisma:generate` | `prisma generate` | Genera el cliente de Prisma en `src/generated/prisma` |
| `prisma:migrate` | `prisma migrate dev` | Crea y aplica migraciones de base de datos |

### Ejecución en desarrollo

```bash
npm run dev
```

### Generación de Prisma Client

Cada vez que se modifique `prisma/schema.prisma` es necesario regenerar el cliente:

```bash
npm run prisma:generate
```

El cliente se genera en `src/generated/prisma` (dentro de `src/` deliberadamente, para que quede bajo el `rootDir` de TypeScript y pueda compilarse junto con el resto del proyecto).

### Compilación del proyecto

```bash
npm run build
```

## Arquitectura del proyecto

El proyecto sigue una arquitectura por capas inspirada en Clean Architecture, pensada para aplicar los principios SOLID de forma natural:

- **`config/`** — Configuración e infraestructura transversal: carga/validación de variables de entorno (`env.ts`) e instanciación del cliente de Prisma (`prisma.client.ts`).
- **`controllers/`** *(pendiente)* — Adaptador HTTP: traducirá `req`/`res` de Express hacia llamadas a `services/`, sin lógica de negocio.
- **`services/`** — Casos de uso y reglas de negocio (validaciones de campos, transiciones de estado), independientes de Express y de Prisma.
- **`repositories/`** — Única capa que conoce Prisma; implementa el acceso a datos definido por `interfaces/`.
- **`interfaces/`** — Contratos (abstracciones) que desacoplan capas entre sí y habilitan Dependency Inversion.
- **`routes/`** *(pendiente)* — Mapeo de verbo HTTP + path hacia un método de `controllers/`.
- **`validators/`** — Validación de forma/formato de la entrada con Zod, separada de la lógica de negocio.
- **`middlewares/`** *(pendiente)* — Cross-cutting concerns (manejo de errores, 404, etc.).
- **`types/`** — DTOs y tipos de dominio, independientes del modelo generado por Prisma.
- **`utils/`** *(pendiente)* — Helpers genéricos sin significado de negocio.

### Flujo de una solicitud (diseño objetivo)

```
HTTP Request
    ↓
Controller
    ↓
Service
    ↓
Repository Interface
    ↓
Repository Implementation
    ↓
Prisma
    ↓
PostgreSQL
```

Actualmente implementado de extremo a extremo: **Service → Repository Interface → Repository Implementation → Prisma → PostgreSQL**. `SolicitudOperativaService` recibe `ISolicitudOperativaRepository` por constructor (constructor injection) y aplica las reglas de negocio antes de delegar en el repositorio. Los tramos `Controller` y `Route` se agregarán en las próximas fases sin modificar los contratos ya definidos en `interfaces/`.

## Aplicación de principios SOLID

Esta sección documenta, con evidencia real del código (no hipotética), cómo el diseño actual aplica cada principio SOLID.

### Single Responsibility Principle (SRP)

**Explicación:** una clase o módulo debe tener una única razón para cambiar. En este proyecto, cada capa cambia por un motivo distinto: la persistencia cambia si cambia la forma de guardar datos; la configuración cambia si cambian las variables de entorno.

**Aplicación:**
Archivo: `src/repositories/solicitudOperativa.repository.ts`

**Justificación:** `SolicitudOperativaRepository` solo se ocupa de traducir operaciones CRUD hacia Prisma y de mapear el resultado a un tipo de dominio (`toDomain`). No valida datos, no conoce Express y no contiene reglas de negocio — su única razón de cambio es "cómo se persisten los datos".

Fragmento real:

```typescript
export class SolicitudOperativaRepository implements ISolicitudOperativaRepository {
  async create(data: CreateSolicitudOperativaDTO): Promise<SolicitudOperativa> {
    const created = await prisma.solicitudOperativa.create({
      data: {
        titulo: data.titulo,
        areaSolicitante: data.areaSolicitante,
        prioridad: data.prioridad,
        costoEstimado: data.costoEstimado,
        ...(data.estado !== undefined && { estado: data.estado }),
      },
    });
    return toDomain(created);
  }
```

Un segundo ejemplo de SRP, más pequeño: `src/config/env.ts` tiene la única responsabilidad de leer y validar variables de entorno, sin mezclar esa lógica con la creación del cliente de Prisma (que vive en `prisma.client.ts`):

```typescript
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
```

Un tercer ejemplo, ahora en la capa de negocio: `src/services/solicitudOperativa.service.ts` cambia únicamente si cambian las reglas de negocio de `SolicitudOperativa` (validaciones, transiciones de estado) — no conoce Express ni Prisma. Cada regla de validación vive en su propio método privado, en vez de un único bloque gigante:

```typescript
private validatePrioridad(prioridad: number): void {
  if (!Number.isInteger(prioridad) || prioridad < 1 || prioridad > 5) {
    throw new InvalidSolicitudDataError('La prioridad debe ser un entero entre 1 y 5');
  }
}

private validateCostoEstimado(costoEstimado: string): void {
  const valor = Number(costoEstimado);
  if (Number.isNaN(valor) || valor <= 0) {
    throw new InvalidSolicitudDataError('El costo estimado debe ser mayor que 0');
  }
}
```

Un cuarto ejemplo, ahora en el límite de entrada de la API: `src/validators/solicitudOperativa.validator.ts` cambia únicamente si cambia el **formato** aceptado del payload HTTP (tipos, longitudes, rangos numéricos) — no conoce Express, no conoce Prisma, no llama a `repositories/` y no decide reglas de negocio dependientes del estado actual de una solicitud (esas siguen siendo responsabilidad exclusiva de `services/`, ver la nota de "Responsabilidades" en `docs/ARCHITECTURE.md`):

```typescript
export const createSolicitudOperativaSchema = z
  .object({
    titulo: tituloSchema,
    areaSolicitante: areaSolicitanteSchema,
    prioridad: prioridadSchema,
    costoEstimado: costoEstimadoSchema,
  })
  .strict();
```

### Open/Closed Principle (OCP)

**Explicación:** el código debe estar abierto a extensión pero cerrado a modificación. Se logra dependiendo de abstracciones en lugar de implementaciones concretas.

**Aplicación:**
Archivo: `src/services/solicitudOperativa.service.ts`

**Justificación:** `SolicitudOperativaService` recibe `ISolicitudOperativaRepository` (la abstracción) por constructor, no una instancia concreta de `SolicitudOperativaRepository`. Esto significa que se puede introducir una nueva implementación del repositorio (por ejemplo, una en memoria para tests, o una basada en otro ORM) y usarla dentro del servicio **sin modificar una sola línea de `SolicitudOperativaService`** — solo se le inyecta la nueva instancia al construirlo. La clase está cerrada a modificación, pero abierta a extensión a través del parámetro del constructor.

Fragmento real:

```typescript
export class SolicitudOperativaService implements ISolicitudOperativaService {
  constructor(private readonly repository: ISolicitudOperativaRepository) {}
```

Antes de implementar `services/`, esta propiedad era solo estructural (la interfaz existía pero no tenía consumidor real). Ahora está demostrada con código que efectivamente depende de la abstracción y no de la clase concreta.

### Liskov Substitution Principle (LSP)

**Explicación:** cualquier implementación de una abstracción debe poder sustituir a otra sin alterar el comportamiento esperado por quien la consume.

**Aplicación:**
Archivo: `src/repositories/solicitudOperativa.repository.ts` (implementación) vs. `src/interfaces/solicitudOperativa.repository.interface.ts` (contrato)

**Justificación:** la firma de cada método de `SolicitudOperativaRepository` coincide exactamente con la firma declarada en `ISolicitudOperativaRepository`, incluyendo los casos límite: `findById` siempre devuelve `SolicitudOperativa | null` (nunca lanza una excepción cuando no encuentra el registro), por lo que cualquier otra implementación futura (ej. una in-memory para tests) deberá respetar ese mismo contrato de retorno para ser sustituible sin sorpresas.

Fragmento real:

```typescript
// interfaz:
findById(id: number): Promise<SolicitudOperativa | null>;

// implementación:
async findById(id: number): Promise<SolicitudOperativa | null> {
  const record = await prisma.solicitudOperativa.findUnique({ where: { id } });
  return record ? toDomain(record) : null;
}
```

Ahora que existe un consumidor real de este contrato, se puede ver por qué el `| null` importa concretamente: `SolicitudOperativaService` confía en que **cualquier** implementación de `ISolicitudOperativaRepository` devuelva `null` (y no lance una excepción) cuando el registro no existe, para poder traducir esa ausencia en su propio error de dominio:

```typescript
async findById(id: number): Promise<SolicitudOperativa> {
  const solicitud = await this.repository.findById(id);
  if (!solicitud) {
    throw new SolicitudNotFoundError(id);
  }
  return solicitud;
}
```

Si una implementación alternativa del repositorio violara ese contrato (por ejemplo, lanzando una excepción en vez de devolver `null`), rompería silenciosamente esta lógica del servicio sin que el compilador lo detecte — por eso la sustituibilidad del contrato exacto (LSP) importa aquí, no solo como teoría.

### Interface Segregation Principle (ISP)

**Explicación:** los clientes no deben ser forzados a depender de métodos que no usan. Es preferible tener varias interfaces pequeñas y específicas en lugar de una interfaz grande de propósito general.

**Aplicación:**
Archivos: `src/interfaces/solicitudOperativa.repository.interface.ts` y `src/interfaces/solicitudOperativa.service.interface.ts`

**Justificación:** el proyecto separa, en dos archivos distintos, el contrato de persistencia (`ISolicitudOperativaRepository`) del contrato de casos de uso (`ISolicitudOperativaService`). Cada uno expone únicamente lo que su respectivo consumidor necesita, ni un método más: `ISolicitudOperativaRepository` no incluye validación ni reglas de negocio; `ISolicitudOperativaService` no incluye detalles de persistencia (no expone, por ejemplo, ningún método relacionado con Prisma o SQL).

Fragmento real — contrato de persistencia (cinco métodos, sin nada adicional):

```typescript
export interface ISolicitudOperativaRepository {
  create(data: CreateSolicitudOperativaDTO): Promise<SolicitudOperativa>;
  findAll(): Promise<SolicitudOperativa[]>;
  findById(id: number): Promise<SolicitudOperativa | null>;
  update(id: number, data: UpdateSolicitudOperativaDTO): Promise<SolicitudOperativa>;
  delete(id: number): Promise<void>;
}
```

Fragmento real — contrato de casos de uso (mismos nombres de operación, pero `findById` no es nullable, porque a este nivel "no encontrado" es una condición de negocio, no un resultado normal de una consulta):

```typescript
export interface ISolicitudOperativaService {
  create(data: CreateSolicitudOperativaDTO): Promise<SolicitudOperativa>;
  findAll(): Promise<SolicitudOperativa[]>;
  findById(id: number): Promise<SolicitudOperativa>;
  update(id: number, data: UpdateSolicitudOperativaDTO): Promise<SolicitudOperativa>;
  delete(id: number): Promise<void>;
}
```

### Dependency Inversion Principle (DIP)

**Explicación:** los módulos de alto nivel no deben depender de módulos de bajo nivel; ambos deben depender de abstracciones.

**Aplicación:**
Archivo: `src/interfaces/solicitudOperativa.repository.interface.ts`

**Justificación:** el contrato de persistencia no importa nada de Prisma ni del cliente generado — depende únicamente de tipos propios de la aplicación (`src/types/solicitudOperativa.types.ts`). Quien dependa de `ISolicitudOperativaRepository` (a futuro, `services/`) dependerá de esta abstracción, no de `SolicitudOperativaRepository` ni de Prisma directamente.

Fragmento real (únicos imports del archivo — ninguno de Prisma):

```typescript
import type {
  CreateSolicitudOperativaDTO,
  SolicitudOperativa,
  UpdateSolicitudOperativaDTO,
} from '../types/solicitudOperativa.types';
```

Y la implementación concreta declara explícitamente que cumple ese contrato:

```typescript
export class SolicitudOperativaRepository implements ISolicitudOperativaRepository {
```

La inversión de dependencia ya está completa en la capa de servicios: `SolicitudOperativaService` (módulo de alto nivel, reglas de negocio) recibe `ISolicitudOperativaRepository` (la abstracción) por constructor, y no importa en ningún momento `SolicitudOperativaRepository` (el módulo de bajo nivel) ni nada de `src/generated/prisma`:

```typescript
export class SolicitudOperativaService implements ISolicitudOperativaService {
  constructor(private readonly repository: ISolicitudOperativaRepository) {}
```

Quien construya el servicio (en la próxima fase, probablemente `app.ts` o un contenedor de dependencias simple) decidirá qué implementación concreta de `ISolicitudOperativaRepository` inyectar — hoy sería `new SolicitudOperativaService(new SolicitudOperativaRepository())`, pero `SolicitudOperativaService` en sí no depende de esa decisión.
