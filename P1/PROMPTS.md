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

## Prompt 4

### Objetivo

Implementar la capa `services/` (lógica de negocio de `SolicitudOperativa`) desacoplada de Express y Prisma, usando constructor injection sobre `ISolicitudOperativaRepository`, con reglas de negocio de creación, transición de estado en actualización y validación de existencia antes de actualizar/eliminar.

### Prompt enviado

> Continuemos con la siguiente capa de la arquitectura: services/. [...] Crear `src/services/solicitudOperativa.service.ts` y si es necesario `src/interfaces/solicitudOperativa.service.interface.ts`. [...] `SolicitudOperativaService` debe recibir `ISolicitudOperativaRepository` mediante constructor injection, depender de la interfaz (no de la clase concreta), contener reglas de negocio, no importar Express ni Prisma. Reglas: en CREATE, título y área obligatorios, prioridad 1-5, costoEstimado > 0, estado inicial siempre `registrada`. En UPDATE, validar existencia y aplicar transiciones válidas de estado (registrada→en_proceso, en_proceso→completada, registrada→cancelada, en_proceso→cancelada), sin permitir otras. En DELETE, validar existencia. Crear errores de dominio simples, sin manejar HTTP. Ejecutar `npm run build`, explicar cómo se evidencia SRP/DIP/OCP/LSP, y actualizar `README.md` y `PROMPTS.md` con la nueva evidencia real.

### Resultado obtenido

Se creó `src/interfaces/solicitudOperativa.service.interface.ts` con el contrato `ISolicitudOperativaService` (mismas cinco operaciones que el repositorio, pero `findById` no nullable) y `src/services/solicitudOperativa.service.ts` con la clase `SolicitudOperativaService`, que recibe `ISolicitudOperativaRepository` por constructor y define tres errores de dominio (`SolicitudNotFoundError`, `InvalidSolicitudDataError`, `InvalidEstadoTransitionError`) junto con una tabla `TRANSICIONES_VALIDAS` como única fuente de verdad de las transiciones permitidas. `npm run build` compiló sin errores. Se actualizó la sección SOLID del `README.md` con evidencia real de las cinco capas (constructor injection real para OCP/DIP, contraste `findById` nullable vs. no-nullable para LSP/ISP, métodos de validación privados para SRP).

### Ajustes realizados

No se crearon archivos fuera de los dos solicitados: los errores de dominio se definieron dentro del propio `solicitudOperativa.service.ts` en lugar de un módulo `errors/` separado, para respetar el alcance explícito de la fase ("implementa únicamente la capa de servicios"). Se decidió que el estado inicial en `create()` se fuerza siempre a `'registrada'` ignorando cualquier `estado` que el llamador intente enviar en el DTO de creación, en vez de simplemente validarlo, por ser la interpretación más segura de "el estado inicial debe ser registrada". No se actualizaron `docs/ARCHITECTURE.md` ni `docs/DATABASE.md` en esta fase porque el alcance solicitado solo mencionaba `README.md` y este archivo de prompts; quedan con la nota "services/ pendiente" desactualizada hasta la próxima fase.

(Nota: en una fase intermedia posterior, no listada aquí como prompt separado por ser puramente documental, se actualizó `docs/ARCHITECTURE.md` para reflejar que `services/` y la Dependency Injection ya estaban implementados.)

## Prompt 5

### Objetivo

Implementar `src/validators/solicitudOperativa.validator.ts` con esquemas Zod para `create` y `update`, validando exclusivamente el formato/forma del payload de entrada, sin duplicar las reglas de negocio ni las transiciones de estado que ya viven en `services/`.

### Prompt enviado

> Continuemos con la siguiente capa: validators/. Implementa únicamente validación de entrada utilizando Zod. [...] Crear `createSolicitudOperativaSchema` (titulo requerido string máx. 200, areaSolicitante requerido string máx. 100, prioridad entero 1-5, costoEstimado positivo con representación adecuada para dinero) y `updateSolicitudOperativaSchema` (todos los campos opcionales, estado solo con los 4 valores válidos). No importar Express, no importar Prisma, no llamar repositories, no contener reglas de transición de estados, no duplicar lógica del Service. Ejecutar `npm run build`, actualizar `README.md` solo si hay nueva evidencia SOLID real, actualizar `PROMPTS.md` con Prompt 5, y explicar qué responsabilidades quedan en el validator y cuáles permanecen en el service.

### Resultado obtenido

Se instaló `zod` (v4) y se creó `src/validators/solicitudOperativa.validator.ts` con `createSolicitudOperativaSchema` y `updateSolicitudOperativaSchema` (este último construido con `.partial()` sobre los mismos schemas de campo reutilizados). Ambos usan `.strict()` para rechazar claves no declaradas — en particular, `createSolicitudOperativaSchema` no declara `estado` en absoluto, por lo que un intento de enviarlo en el payload de creación es rechazado explícitamente por Zod (`"Unrecognized key: estado"`), reforzando en el límite de entrada la misma regla de negocio que ya fuerza el service ("el estado inicial siempre es `registrada`"). `costoEstimado` se valida como `string` con una regex de hasta 2 decimales, coherente con la representación decimal-safe ya usada en `types/`/`repositories/`. Se verificó el comportamiento real con casos de prueba ad-hoc (ejecutados con `tsx` y luego eliminados) antes de dar la tarea por completa. Se agregó un cuarto ejemplo de SRP en el `README.md`; no se encontró evidencia nueva genuina para OCP, LSP, ISP o DIP, así que esas secciones no se tocaron.

### Ajustes realizados

La API de mensajes de error de Zod cambió entre v3 y v4: `required_error` (v3) ya no existe y hubo que usar `error` (v4) en su lugar — esto se detectó porque `npm run build` falló con `TS2769`/`TS2353` en las cuatro definiciones de schema, no porque se hubiera anticipado. También se resolvió explícitamente la aparente tensión con "no duplicar lógica del Service": `prioridad` (1-5) y `costoEstimado` (> 0) se validan en ambas capas, pero por razones distintas — `validators/` rechaza payloads HTTP mal formados en el límite de entrada (rápido, declarativo, sin acceso a base de datos), mientras que `services/` sigue siendo la única fuente de verdad de las reglas de negocio reales (transiciones de estado, existencia previa, y forzar `estado: 'registrada'` en creación) y actúa como defensa en profundidad para cualquier llamador que no pase por HTTP/`validators/`. Esta distinción se explica en la respuesta final, no se documentó todavía en `docs/ARCHITECTURE.md` (fuera del alcance pedido en esta fase).

## Prompt 6

### Objetivo

Implementar `src/controllers/solicitudOperativa.controller.ts` como adaptador HTTP entre Express y `services/`, con los cinco métodos CRUD, usando los validators de Zod ya existentes para los payloads y delegando cualquier error a `next(error)` sin traducirlo a códigos HTTP todavía.

### Prompt enviado

> Continuemos con la implementación de la capa controllers/. Implementa únicamente controllers, sin crear todavía routes ni middlewares globales. [...] `SolicitudOperativaController` debe recibir `ISolicitudOperativaService` mediante constructor injection, no importar repositories ni Prisma, no contener reglas de negocio, no duplicar validaciones del service, usar validators existentes para validar payloads. Implementar `create/findAll/findById/update/delete(req, res, next)`. CREATE valida con `createSolicitudOperativaSchema` y responde 201; FIND ALL responde 200; FIND BY ID convierte el id de params y responde 200; UPDATE valida con `updateSolicitudOperativaSchema` y responde 200; DELETE responde 204. No capturar errores de negocio para convertirlos aquí — usar `next(error)`. Ejecutar `npm run build`, explicar cómo se mantiene SRP y DIP, y agregar Prompt 6 en `PROMPTS.md`.

### Resultado obtenido

Se creó `src/controllers/solicitudOperativa.controller.ts` con la clase `SolicitudOperativaController`, que recibe `ISolicitudOperativaService` por constructor y expone los cinco métodos como propiedades de tipo arrow function (para conservar `this` cuando Express las use como referencias sueltas en `routes/`, sin necesitar `.bind()`). Cada método hace `try { ... } catch (error) { next(error); }`, sin inspeccionar ni traducir el tipo de error. `create` valida con `createSolicitudOperativaSchema.parse(req.body)`; `update` valida con `updateSolicitudOperativaSchema.parse(req.body)`. `npm run build` compiló sin errores tras dos ajustes de tipado.

### Ajustes realizados

`npm run build` falló dos veces antes de compilar limpio, por razones no anticipadas en el prompt original: (1) Express 5 tipa `req.params['id']` como `string | string[] | undefined` (por el soporte de `path-to-regexp` a segmentos repetidos en rutas), no solo `string | undefined` como en Express 4 — se ajustó `parseId` para aceptar y rechazar explícitamente el caso `string[]`. (2) Con `exactOptionalPropertyTypes: true`, el tipo inferido por `updateSolicitudOperativaSchema.partial()` de Zod (propiedades opcionales tipadas como `T | undefined`) no era asignable directamente a `UpdateSolicitudOperativaDTO` (propiedades opcionales `T` sin `undefined` explícito) — se agregó un `toUpdateDTO()` que reconstruye el objeto con el mismo patrón de spread condicional (`...(x !== undefined && { x })`) ya usado en `repositories/solicitudOperativa.repository.ts` y `services/solicitudOperativa.service.ts`, evitando introducir un estilo nuevo. Se definió `InvalidIdError` (un error simple, sin código HTTP) para el caso de un id no numérico en la URL, ya que el enunciado pide "convertir el id al tipo correcto" pero no menciona dónde vive ese contrato de error — se mantuvo co-ubicado en el propio archivo del controller, siguiendo el mismo precedente de `services/solicitudOperativa.service.ts` (errores definidos junto a la clase que los lanza). No se actualizó `README.md` en esta fase porque no fue solicitado explícitamente.

## Prompt 7

### Objetivo

Cablear las capas ya existentes (repository → service → controller) mediante un composition root (`config/container.ts`), crear el `Router` de Express para `SolicitudOperativa`, y registrar esas rutas en `app.ts`, sin implementar todavía middleware global de errores ni `server.ts`.

### Prompt enviado

> Continuemos con el cableado de dependencias y creación de rutas. Implementa únicamente: 1. Composition root / dependency wiring. 2. Routes de SolicitudOperativa. [...] Crear `src/config/container.ts`: único lugar donde se conocen implementaciones concretas (`SolicitudOperativaRepository` → `SolicitudOperativaService` → `SolicitudOperativaController`). No crear instancias dentro de controllers ni de routes. Crear `src/routes/solicitudOperativa.routes.ts` con `POST/GET /solicitudes`, `GET/PUT/DELETE /solicitudes/:id`, que únicamente mapeen endpoint → método del controller. Actualizar `app.ts` solamente si es necesario para registrar las rutas existentes. No implementar todavía middleware global de errores. Ejecutar `npm run build`, explicar cómo `container.ts` refuerza DIP, y agregar Prompt 7 en `PROMPTS.md`.

### Resultado obtenido

Se creó `src/config/container.ts`, que instancia `SolicitudOperativaRepository`, se la inyecta a `SolicitudOperativaService`, y a su vez inyecta ese servicio a `SolicitudOperativaController`, exportando un único objeto `container` con la instancia ya construida del controller. Se creó `src/routes/solicitudOperativa.routes.ts` con un `Router` de Express que mapea las cinco rutas directamente a los métodos del controller obtenido de `container` (`solicitudOperativaController.create`, `.findAll`, etc.), sin ningún `new` dentro del archivo. Se implementó `src/app.ts` (antes vacío) creando la instancia de Express, registrando `express.json()` (necesario para que `req.body` exista y los validators de `create`/`update` puedan funcionar) y montando el router. `npm run build` compiló sin errores. Se verificó el cableado completo con una prueba de humo ad-hoc (`tsx`, eliminada después): una ruta inexistente devolvió 404; un `POST /solicitudes` con body vacío llegó hasta el controller y produjo el `ZodError` esperado; un `GET /solicitudes` llegó hasta Prisma y devolvió el error real de PostgreSQL "la tabla `solicitudes_operativas` no existe" (confirmando que la base de datos sí está accesible, solo falta correr `prisma migrate dev`); y `GET /solicitudes/abc` disparó `InvalidIdError` desde el controller. Los cuatro casos, al no existir todavía middleware de errores, devolvieron 500 vía el manejador de errores por defecto de Express — comportamiento esperado en esta fase.

### Ajustes realizados

No se implementó `src/routes/index.ts` como agregador de routers: el enunciado solo pedía crear `solicitudOperativa.routes.ts` y actualizar `app.ts` "solamente si es necesario", y con un único recurso en el proyecto, introducir una capa de agregación adicional habría sido una abstracción prematura sin beneficio real todavía; `app.ts` monta `solicitudOperativa.routes.ts` directamente. Tampoco se implementó `server.ts`: no estaba en la lista explícita de entregables de esta fase, y arrancar el servidor sin el middleware de manejo de errores (fase siguiente) dejaría cualquier error no controlado devolviendo HTML de Express en vez de JSON — se prefirió dejarlo pendiente en vez de arrancar un servidor a medio terminar. No se modificaron `services/`, `repositories/` ni `controllers/`: ya estaban correctamente preparados para constructor injection desde fases anteriores.

## Prompt 8

### Objetivo

Completar el backend de punta a punta: middleware global de manejo de errores, middleware 404, `server.ts` (arranque + cierre limpio), y registrar todo en `app.ts` en el orden correcto — cerrando el ciclo completo del CRUD de `SolicitudOperativa` sin modificar reglas de negocio existentes.

### Prompt enviado

> Continuemos con la última fase del backend. [...] Crear `src/middlewares/error.middleware.ts`: debe capturar y transformar a JSON consistente `{ success: false, message }` (con detalle en validación) los errores `ZodError`, `InvalidIdError`, `SolicitudNotFoundError`, errores de reglas de negocio, errores de Prisma cuando corresponda, y cualquier `Error` genérico — sin exponer stack traces. Crear middleware 404 que responda JSON, nunca HTML. Crear `src/server.ts`: importar `app`, leer configuración, iniciar Express, escuchar el puerto, mostrar mensaje de inicio, manejar cierre limpio (SIGINT/SIGTERM). No mover lógica de `app.ts` a `server.ts`. Actualizar `app.ts` registrando `express.json()`, rutas, 404 y error handler en el orden correcto. No modificar reglas de negocio del Service, Validators salvo error real, ni Repository salvo estrictamente necesario. Ejecutar `npm run build`, explicar el flujo completo de una petición HTTP hasta PostgreSQL, cómo interviene el middleware de errores, confirmar SRP/DIP/OCP, e indicar si solo falta correr la migración de Prisma.

### Resultado obtenido

Se implementaron los dos archivos de middleware ya reservados en el scaffold original: `src/middlewares/errorHandler.middleware.ts` (mapea `ZodError` → 400 con detalle por campo, `InvalidIdError`/`InvalidSolicitudDataError` → 400, `SolicitudNotFoundError` → 404, `InvalidEstadoTransitionError` → 409, errores de Prisma con código conocido → 404 si es `P2025` o 400 genérico en otro caso, y cualquier otro error → 500 genérico) y `src/middlewares/notFound.middleware.ts` (404 JSON para cualquier ruta no registrada). Se creó `src/server.ts`: importa `app`, lee `env.PORT`, llama a `app.listen(...)`, imprime un mensaje de arranque, y en `SIGINT`/`SIGTERM` cierra el servidor HTTP y desconecta el `PrismaClient` antes de salir. Se actualizó `app.ts` para registrar, en orden, `express.json()` → rutas → `notFoundHandler` → `errorHandler`. `npm run build` compiló sin errores. Se verificó el flujo completo con una prueba de humo real (`tsx`, eliminada después): ruta inexistente → `404 {"success":false,"message":"Route not found"}`; `POST /solicitudes` con body vacío → `400` con el detalle de cada campo faltante; `GET /solicitudes/abc` → `400` con el mensaje de `InvalidIdError`; `GET /solicitudes` y `GET /solicitudes/999999` → `400 {"success":false,"message":"Error al procesar la solicitud en la base de datos"}` (la tabla `solicitudes_operativas` todavía no existe). También se corrió `prisma migrate status` (comando de solo lectura) para confirmar el estado real: no hay ninguna migración creada, la base de datos no está gestionada por Prisma Migrate.

### Ajustes realizados

Se usó el archivo ya existente `src/middlewares/errorHandler.middleware.ts` en vez de crear uno nuevo `error.middleware.ts` como decía el prompt literal, para no duplicar/fragmentar el scaffold ya reservado desde la primera fase — mismo criterio aplicado antes con `config/prisma.client.ts` en el Prompt 2. Se detectó una tensión real entre dos instrucciones: "capturar errores de Prisma cuando corresponda" vs. la regla ya documentada en `docs/ARCHITECTURE.md` de que `repositories/` es la única capa que debe importar Prisma — importar `Prisma.PrismaClientKnownRequestError` en el middleware habría roto esa regla. Se resolvió con una comprobación estructural (*duck typing*: `'code' in error && 'clientVersion' in error`) en vez de un `instanceof` directo, documentada explícitamente como decisión de diseño #5 en `docs/ARCHITECTURE.md`. No se modificó `services/`, `repositories/` ni `validators/` — no hizo falta. No se ejecutó `prisma migrate dev` (se dejó expresamente pendiente para que lo corra el usuario, según lo pedido: "indícalo claramente pero no modifiques el esquema existente"). Se actualizaron `README.md` y `docs/ARCHITECTURE.md` de forma más amplia de lo estrictamente necesario para esta fase, porque ambos habían quedado desactualizados desde fases anteriores (`container.ts`, `controllers/`, `routes/` nunca se habían documentado en `ARCHITECTURE.md`); se aprovechó este cierre de fase para ponerlos al día en vez de dejar la documentación fragmentada.
