# Registro de uso de IA (Claude Code)

Este documento registra los prompts utilizados durante el desarrollo del backend, el resultado obtenido y los ajustes realizados tras revisar cada respuesta, conforme a los lineamientos de entrega académica.

## Prompt 1

### Objetivo

Diseñar la arquitectura por capas del proyecto antes de escribir cualquier CRUD, verificar la configuración existente de TypeScript/Prisma/Express, y generar el modelo `SolicitudOperativa` en `prisma/schema.prisma`.

### Prompt enviado

> Actúa como un Software Architect Senior especializado en TypeScript, Express.js, Prisma ORM, PostgreSQL, Clean Architecture, Clean Code, principios SOLID y OWASP Top 10.
>
> Estoy desarrollando una práctica universitaria. Quiero que me ayudes a construir el proyecto paso a paso [...] Primero quiero diseñar correctamente la arquitectura del proyecto. [...]
>
> La entidad principal será SolicitudOperativa con los campos id, titulo, area_solicitante, prioridad (1-5), costo_estimado (decimal), estado (registrada, en_proceso, completada, cancelada). La API deberá implementar posteriormente GET/POST/PUT/DELETE /solicitudes y PATCH /solicitudes/:id/estado.
>
> Objetivos: analizar el proyecto existente, verificar TypeScript/Prisma/Express, proponer arquitectura por capas para SOLID, explicar cada carpeta, crear la estructura de carpetas y archivos vacíos, generar `prisma/schema.prisma` con el modelo, explicar cada campo, no implementar controladores/CRUD todavía, indicar dependencias faltantes y señalar problemas de configuración.

### Resultado obtenido

Un diagnóstico del proyecto (sin `package.json`, sin `src/`, `tsconfig.json` con `types: []` y `jsx` residual de un template frontend), una propuesta de arquitectura por capas (`config/`, `controllers/`, `services/`, `repositories/`, `routes/`, `middlewares/`, `validators/`, `interfaces/`, `utils/`, `types/`), la creación de todos los archivos vacíos de esa estructura, el modelo `SolicitudOperativa` en `schema.prisma`, y la instalación de las dependencias base (`express`, `dotenv`, `cors`, `helmet`, `typescript`, `prisma`, `tsx`, tipos de Node/Express/cors).

### Ajustes realizados

Antes de escribir el schema, la IA identificó tres decisiones que afectaban a todo el proyecto y las presentó como preguntas explícitas en lugar de asumirlas: (1) convención de nombres de campos — se eligió camelCase en TypeScript/Prisma con `@map` hacia snake_case en la base de datos; (2) si agregar campos de auditoría `createdAt`/`updatedAt` — se decidió **no** agregarlos, manteniendo el modelo limitado a los campos del enunciado; (3) sistema de módulos de TypeScript — se eligió CommonJS sobre el `nodenext` (ESM estricto) que traía el `tsconfig.json` original, para evitar la fricción de extensiones `.js` explícitas en imports relativos.

## Prompt 2

### Objetivo

Implementar el Repository Pattern: la interfaz `ISolicitudOperativaRepository` y su implementación concreta `SolicitudOperativaRepository`, aplicando DIP y LSP, sin tocar `services/`, `controllers/` ni `routes/`.

### Prompt enviado

> Continuemos con la implementación del CRUD siguiendo la arquitectura por capas definida. En esta fase implementa únicamente: 1. interfaces/ 2. repositories/. [...] La interfaz no debe importar Prisma directamente y debe trabajar con tipos propios de la aplicación. El repositorio debe ser la única capa que conoce Prisma, usar `PrismaClient` desde `config/prisma.ts`, no contener reglas de negocio, no validar datos, no manejar HTTP. [...] Manejar correctamente Decimal de Prisma sin convertirlo prematuramente a number. [...] Ejecuta `npm run build` para verificar que compile.

### Resultado obtenido

Se crearon `src/types/solicitudOperativa.types.ts` (DTOs de dominio sin dependencia de Prisma), `src/interfaces/solicitudOperativa.repository.interface.ts` (contrato `ISolicitudOperativaRepository`) y `src/repositories/solicitudOperativa.repository.ts` (implementación con un mapeo `toDomain` que convierte el `Decimal` de Prisma a `string` mediante `.toString()`, evitando `.toNumber()`). También se detectaron y corrigieron dos problemas de infraestructura no anticipados: el generador de Prisma 7 exige un *driver adapter* explícito (se instaló `@prisma/adapter-pg` y `pg`, y se implementó `config/env.ts` y `config/prisma.client.ts`), y el output del cliente generado quedaba fuera del `rootDir` de TypeScript (se movió a `src/generated/prisma` y se agregó `"include": ["src/**/*.ts"]` al `tsconfig.json`).

### Ajustes realizados

El nombre de archivo mencionado en el prompt (`config/prisma.ts`) no coincidía con el ya scaffoldeado en la fase anterior (`config/prisma.client.ts`); se mantuvo el nombre existente por ser más descriptivo y evitar confusión con `prisma.config.ts` (el archivo de configuración del CLI de Prisma). Se verificó la compilación con `npm run build` antes de dar la fase por cerrada.

## Prompt 3

### Objetivo

Generar la documentación formal del proyecto (`README.md`, sección SOLID, `PROMPTS.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`) basada estrictamente en el código ya implementado, sin inventar clases ni fragmentos inexistentes, antes de continuar con `services/`.

### Prompt enviado

> Antes de continuar con la implementación de services/, vamos a generar la documentación formal del proyecto. [...] Revisa primero el código existente. La documentación debe basarse en la implementación real actual. No inventes clases, archivos ni fragmentos de código que no existan. Cuando menciones SOLID, utiliza evidencias reales del proyecto indicando archivo, clase/método y fragmento de código correspondiente. [...]

### Resultado obtenido

Este mismo conjunto de documentos (`README.md`, `PROMPTS.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`), redactados a partir de la lectura directa de los archivos fuente existentes en el momento de la generación, citando rutas de archivo y fragmentos de código literales.

### Ajustes realizados

Se marcó explícitamente en el `README.md` y en `docs/ARCHITECTURE.md` qué capas están implementadas (`config/`, `interfaces/`, `repositories/`, `types/`) y cuáles siguen vacías (`services/`, `controllers/`, `routes/`, `validators/`, `middlewares/`, `utils/`), para no dar la impresión de que el CRUD completo ya existe. En la sección de Open/Closed y de Interface Segregation se agregó una nota honesta indicando que la propiedad de "extensibilidad sin modificación" es, por ahora, estructural (no demostrada todavía con una segunda implementación real), ya que `services/` aún no consume la interfaz de repositorio.
