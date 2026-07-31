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

> Estado actual del proyecto: las capas `interfaces/`, `repositories/`, `types/` y `config/` ya están implementadas. Las capas `services/`, `controllers/`, `routes/`, `validators/`, `middlewares/` y `utils/` existen como archivos vacíos (scaffold) pendientes de implementación.

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
- **`services/`** *(pendiente)* — Casos de uso y reglas de negocio, independientes de Express y de Prisma.
- **`repositories/`** — Única capa que conoce Prisma; implementa el acceso a datos definido por `interfaces/`.
- **`interfaces/`** — Contratos (abstracciones) que desacoplan capas entre sí y habilitan Dependency Inversion.
- **`routes/`** *(pendiente)* — Mapeo de verbo HTTP + path hacia un método de `controllers/`.
- **`validators/`** *(pendiente)* — Validación de entrada, separada de la lógica de negocio.
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

Actualmente implementado de extremo a extremo: **Repository Interface → Repository Implementation → Prisma → PostgreSQL**. Los tramos `Controller` y `Service` se agregarán en las próximas fases sin modificar el contrato ya definido en `interfaces/solicitudOperativa.repository.interface.ts`.

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

### Open/Closed Principle (OCP)

**Explicación:** el código debe estar abierto a extensión pero cerrado a modificación. Se logra dependiendo de abstracciones en lugar de implementaciones concretas.

**Aplicación:**
Archivo: `src/interfaces/solicitudOperativa.repository.interface.ts`

**Justificación:** `ISolicitudOperativaRepository` define el contrato completo del CRUD. Es posible crear una nueva implementación (por ejemplo, un repositorio en memoria para pruebas, o uno basado en otro ORM) sin modificar esta interfaz ni el código que ya la implementa — solo se agrega una clase nueva que la implemente.

Fragmento real:

```typescript
export interface ISolicitudOperativaRepository {
  create(data: CreateSolicitudOperativaDTO): Promise<SolicitudOperativa>;
  findAll(): Promise<SolicitudOperativa[]>;
  findById(id: number): Promise<SolicitudOperativa | null>;
  update(id: number, data: UpdateSolicitudOperativaDTO): Promise<SolicitudOperativa>;
  delete(id: number): Promise<void>;
}
```

Nota honesta: en el estado actual del proyecto aún no existe un segundo consumidor de esta interfaz (`services/` está vacío), por lo que la "extensibilidad sin modificación" es today una propiedad estructural del contrato, todavía no demostrada con una segunda implementación real. Se validará cuando se implemente `services/` en la siguiente fase.

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

### Interface Segregation Principle (ISP)

**Explicación:** los clientes no deben ser forzados a depender de métodos que no usan. Es preferible tener varias interfaces pequeñas y específicas en lugar de una interfaz grande de propósito general.

**Aplicación:**
Archivos: `src/interfaces/solicitudOperativa.repository.interface.ts` y `src/interfaces/solicitudOperativa.service.interface.ts`

**Justificación:** el proyecto ya separa, en dos archivos distintos, el contrato de persistencia (`ISolicitudOperativaRepository`) del contrato de casos de uso (`ISolicitudOperativaService`, pendiente de definir su contenido). `ISolicitudOperativaRepository` expone únicamente los cinco métodos que un consumidor de persistencia necesita (`create`, `findAll`, `findById`, `update`, `delete`) — no incluye, por ejemplo, métodos de validación o de formateo HTTP, que corresponden a otras interfaces/capas.

Fragmento real (los cinco métodos, sin nada adicional):

```typescript
export interface ISolicitudOperativaRepository {
  create(data: CreateSolicitudOperativaDTO): Promise<SolicitudOperativa>;
  findAll(): Promise<SolicitudOperativa[]>;
  findById(id: number): Promise<SolicitudOperativa | null>;
  update(id: number, data: UpdateSolicitudOperativaDTO): Promise<SolicitudOperativa>;
  delete(id: number): Promise<void>;
}
```

Nota honesta: `src/interfaces/solicitudOperativa.service.interface.ts` existe como archivo vacío; su contenido se definirá al implementar `services/`.

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

La inversión de dependencia se completará formalmente cuando `services/` reciba `ISolicitudOperativaRepository` por constructor (constructor injection) en lugar de instanciar `SolicitudOperativaRepository` directamente — pendiente para la siguiente fase.
