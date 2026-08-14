# Reporte de Consistencia de Diagramas — Práctica 3

Fecha de revisión: 2026-08-13
Alcance: los 11 diagramas `.puml` ya existentes (clases, secuencia, estados) contra los 2 diagramas nuevos (arquitectura general y componentes). Los modelos ER en Mermaid **no** se revisaron en este paso, por instrucción explícita.

## 1. Resumen ejecutivo

Se revisaron los 11 archivos `.puml` existentes en `puml/01-class-diagrams`, `puml/02-sequence-diagrams` y `puml/03-state-diagrams` antes de diseñar los diagramas nuevos, extrayendo: nombres de microservicios, eventos publicados/consumidos, bases de datos, interfaces, actores y sistemas externos ya utilizados.

Se encontraron **2 inconsistencias reales** (no cosméticas) entre artefactos ya aprobados, y **1 observación menor** de nomenclatura. Las 2 reales se corrigieron; la menor se documenta sin modificar archivos, tal como se explica en la sección 3.

No se encontraron microservicios inventados, microservicios faltantes, accesos cruzados entre bases de datos, ni violaciones a la regla de los 3 pasos de aprobación.

## 2. Tabla de verificación por diagrama

| Diagrama | Elementos verificados | Inconsistencias | Corrección |
|---|---|---|---|
| `ms1-transaction-ingestion.puml` | Entidades, eventos publicados (`BatchUploaded`, `BatchValidated`, `BatchValidationFailed`), puertos externos (`IAccountVerificationClient`, `IFileStorageClient`) | Ninguna | N/A |
| `ms2-approval-workflow.puml` | Estados (`ApprovalStatus`), `SegregationOfDutiesPolicy`, dependencia `IAuthorizationClient` | **Sí** — `IAuthorizationClient` implica que MS2 llama a P2 directamente, pero ningún diagrama de secuencia lo mostraba (solo el Gateway llamaba a P2) | Se decidió mantener el diseño de clases (es el más correcto para un sistema bancario) y **actualizar la secuencia** en `escenario2-flujo-aprobacion.puml` para reflejar la llamada de MS2 a P2 (ver sección 3.A) |
| `ms3-core-bank-integration.puml` | `CoreSubmission`/`CoreSubmissionDetail`, `handleBatchApproved`, `ICoreBankGateway` | Ninguna | N/A |
| `ms4-notification.puml` | `NotificationRecord`, idempotencia `existsByBatchAndEmail`, `IEmailProvider` | Ninguna | N/A |
| `ms5-history-query.puml` | `BatchHistoryProjector`, handlers de eventos consumidos | **Sí** — faltaban handlers para `BatchRejected` y `BatchSubmissionFailed`; `onNotificationSent` no correspondía a ningún evento real publicado (el evento real es `NotificationBatchProcessed`) | Se agregaron `onBatchValidationFailed`, `onBatchRejected`, `onBatchSubmissionFailed`; se renombró `onNotificationSent` → `onNotificationBatchProcessed` (ver sección 3.B) |
| `ms6-audit-logging.puml` | `LogEntry`, `RedactionPolicy`, `IEventSubscriber` genérico | Ninguna (no declara handlers por evento, por lo que no aplica el mismo riesgo que en MS5) | N/A |
| `escenario1-carga-validacion-csv.puml` | Autenticación, autorización, validación RN-01–04, eventos publicados | Ninguna | N/A |
| `escenario2-flujo-aprobacion.puml` | Flujo maker-checker-authorizer, segregación de funciones, eventos | **Sí** (la misma de `ms2-approval-workflow.puml`, vista desde el otro lado) | Se agregó llamada `MS2 -> P2 : hasPermission(...)` en los 3 pasos de decisión + nota explicativa del patrón defense-in-depth |
| `escenario3-envio-core-bancario.puml` | Disparo exclusivo por `BatchApproved`, reintentos, eventos publicados | Ninguna | N/A |
| `escenario4-notificacion-correo.puml` | Disparo exclusivo por `BatchApproved`, idempotencia, evento `NotificationBatchProcessed` | Detectada desde este archivo (ver fila MS5) | Ver corrección aplicada en `ms5-history-query.puml` |
| `flujo-aprobacion-maker-checker-authorizer.puml` (estados) | 5 estados, 7 transiciones, guardas de segregación de funciones | Ninguna — coincide exactamente con `ApprovalStatus` de `ms2-approval-workflow.puml` | N/A |
| `arquitectura-general.puml` **(nuevo)** | Los 6 microservicios, Gateway, OAuth, P2, broker, storage, core, correo, 6 BD propias | Se diseñó ya incorporando las 2 correcciones anteriores | N/A |
| `diagrama-componentes.puml` **(nuevo)** | Interfaces provistas/requeridas, frontera interno/externo, comunicación REST y asíncrona | Se diseñó ya incorporando las 2 correcciones anteriores | N/A |

## 3. Detalle de las correcciones aplicadas

### A. MS2 no re-verificaba permisos contra P2 (defense-in-depth ausente en la secuencia)

- **Archivos afectados:** `01-class-diagrams/ms2-approval-workflow.puml` (origen de la expectativa) y `02-sequence-diagrams/escenario2-flujo-aprobacion.puml` (no la reflejaba).
- **Por qué importa:** en un sistema bancario, una decisión de aprobación (Maker/Checker/Authorizer) muta el estado financiero del lote. Confiar exclusivamente en que el Gateway ya validó el permiso es un único punto de fallo de seguridad — si el Gateway tuviera un bug de enrutamiento o se le hiciera bypass a nivel de red interna, MS2 aceptaría decisiones no autorizadas.
- **Decisión tomada:** no se debilitó el diagrama de clases (que ya era el más correcto). Se corrigió el diagrama de secuencia para que sea fiel a lo que las clases ya declaraban.
- **Cambio aplicado:** en `escenario2-flujo-aprobacion.puml` se agregó, en los 3 puntos de decisión (Maker/Checker/Authorizer), la llamada `MS2 -> P2 : hasPermission(...)` inmediatamente después de `activate MS2` y antes de `SegregationOfDutiesPolicy.canUserApprove(...)`, más una nota explicando el patrón. El Gateway conserva su verificación (rechazo rápido en el perímetro); MS2 repite la verificación (zero-trust interno). No se modificó ningún estado, transición ni evento — es una adición, no un cambio de comportamiento observable.

### B. MS5 (historial) tenía handlers de eventos incompletos y uno mal nombrado

- **Archivo afectado:** `01-class-diagrams/ms5-history-query.puml`.
- **Por qué importa:** RF-09 exige un historial consultable de **todos** los lotes procesados. Sin un handler para `BatchRejected` o `BatchSubmissionFailed`, un lote rechazado o cuyo envío al core falló nunca actualizaría su estado en el historial — quedaría visible con un estado desactualizado, lo cual contradice directamente el requisito de negocio y el criterio 2.3 de la rúbrica ("reflejo de las reglas de validación del negocio").
- **Cambio aplicado:**
  - Se agregaron `onBatchValidationFailed(event)`, `onBatchRejected(event)`, `onBatchSubmissionFailed(event)`.
  - Se renombró `onNotificationSent(event)` → `onNotificationBatchProcessed(event)`, porque el evento que realmente publica `notification-service` (ver `escenario4-notificacion-correo.puml`, línea `MS4 ->> MB : publish NotificationBatchProcessed(...)`) nunca se llamó `NotificationSent` — ese nombre no existe en ningún diagrama de secuencia.
  - No se modificó `BatchHistoryView`, `BatchTimelineEvent` ni `TransactionHistoryView` — el modelo de datos ya aprobado no requería cambios, solo la lista de eventos que el proyector escucha.

### C. Observación menor, no corregida (documentada para criterio del usuario)

- El módulo de la Práctica 2 aparece con tres etiquetas ligeramente distintas: `"Módulo Autorización (P2)"` (diagramas de secuencia existentes), `"Módulo de Autenticación Práctica 2 (roles y permisos)"` (nuevo diagrama de arquitectura) y `"Módulo Autorización Práctica 2"` (nuevo diagrama de componentes). Todas se refieren al mismo componente.
- Esto **no es un error de diseño**: refleja una ambigüedad que ya existía en el propio enunciado (Practica_3_2S2026.pdf, sección 3.1), que llama a este componente "módulo de autenticación" aunque su función descrita es "gestionar permisos y accesos" (autorización). Ya se había señalado como riesgo/ambigüedad en la especificación inicial de la práctica.
- **No se modificaron los diagramas existentes** por esta observación, siguiendo la instrucción de no tocar diagramas de clases/secuencia salvo necesidad estricta. Se deja como recomendación para una futura pasada de homogeneización de etiquetas, no como corrección obligatoria.
- MS6 también tiene doble etiqueta ("audit-logging-service" en clases vs. "MS6: Logging Centralizado" en secuencias) — mismo caso, mismo tratamiento: documentado, no corregido.

## 4. Checklist de los 14 puntos solicitados

| # | Verificación | Resultado |
|---|---|---|
| 1 | ¿Microservicios inexistentes en los diagramas nuevos? | ✅ No — solo MS1–MS6, exactamente como ya definidos |
| 2 | ¿Falta algún microservicio existente? | ✅ No — los 6 aparecen en arquitectura general y en componentes |
| 3 | ¿Nombres consistentes? | ⚠️ Consistentes en lo estructural; 2 observaciones cosméticas de etiqueta (sección 3.C), sin impacto funcional |
| 4 | ¿Responsabilidades coinciden? | ✅ Sí, verificado contra los 6 diagramas de clases |
| 5 | ¿Comunicaciones coinciden? | ✅ Sí, tras corregir A y B — todos los eventos en los diagramas nuevos existen literalmente en algún diagrama de secuencia |
| 6 | ¿Flujo Maker-Checker-Authorizer coherente? | ✅ Sí — igual en clases, secuencia, estados y en los 2 diagramas nuevos |
| 7 | ¿Envío al core solo tras aprobación completa? | ✅ Sí — MS3 solo tiene como entrada `BatchApproved`, estructuralmente imposible de invocar antes |
| 8 | ¿Notificaciones correctamente ubicadas? | ✅ Sí — MS4 disparado únicamente por `BatchApproved`, igual que MS3 |
| 9 | ¿Historial correctamente ubicado? | ✅ Sí, tras la corrección B (antes tenía una laguna real) |
| 10 | ¿Logging/auditoría representado? | ✅ Sí — MS6 recibe eventos del broker y logs directos de los demás servicios en ambos diagramas nuevos |
| 11 | ¿OAuth y Práctica 2 aparecen correctamente? | ✅ Sí — OAuth (perímetro, Gateway) y P2 (Gateway + MS2, tras la corrección A) |
| 12 | ¿Se usa API Gateway? | ✅ Sí — único punto de entrada en ambos diagramas nuevos |
| 13 | ¿Bases de datos independientes? | ✅ Sí — 6 bases de datos, una por microservicio, sin compartir |
| 14 | ¿Acceso directo entre BDs de distintos microservicios? | ✅ No existe — toda información cruzada se obtiene por REST (MS3→MS1, MS4→MS1) o por evento (broker) |

## 5. Archivos modificados en esta revisión

- `puml/02-sequence-diagrams/escenario2-flujo-aprobacion.puml` — se agregaron 3 llamadas `MS2 -> P2` y 1 nota explicativa.
- `puml/01-class-diagrams/ms5-history-query.puml` — se ampliaron/renombraron los métodos de `BatchHistoryProjector`.

Ningún otro archivo de `01-class-diagrams`, `02-sequence-diagrams` o `03-state-diagrams` fue modificado.
