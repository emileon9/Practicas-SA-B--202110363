# Diagramas — Práctica 3 (Diseño de Arquitectura)

Índice de todos los diagramas producidos hasta el momento para el sistema de procesamiento de transacciones bancarias. Fuente: `Practica_3_2S2026.pdf`.

Microservicios de referencia (no varían entre diagramas):

| ID | Nombre técnico | Responsabilidad |
|---|---|---|
| MS1 | `transaction-ingestion-service` | Carga y validación de CSV (RN-01 a RN-04) |
| MS2 | `approval-workflow-service` | Flujo maker-checker-authorizer de 3 pasos |
| MS3 | `core-bank-integration-service` | Envío de lotes aprobados al core bancario externo |
| MS4 | `notification-service` | Notificación por correo a beneficiarios |
| MS5 | `history-query-service` | Historial consultable y descargable de lotes (CQRS) |
| MS6 | `audit-logging-service` | Logging centralizado y auditable |

## Cómo renderizar los `.puml`

```
java -jar plantuml.jar -tsvg <archivo>.puml   # genera SVG
java -jar plantuml.jar -tpng <archivo>.puml   # genera PNG
```

`plantuml.jar` requiere Java (usado aquí: Java 18). No se requiere Graphviz para los diagramas de este proyecto (clases, secuencia, estados, componentes en notación `componentStyle rectangle`/`uml2`).

## 01 — Diagramas de clases (`puml/01-class-diagrams/`)

| Archivo | Contenido |
|---|---|
| `ms1-transaction-ingestion.puml` | `Batch`, `TransactionRecord`, Value Objects (`Money`, `AccountNumber`, `Beneficiary`), `TransactionValidationService` |
| `ms2-approval-workflow.puml` | `ApprovalRequest`, `ApprovalStep`, `SegregationOfDutiesPolicy`, `ApprovalService` |
| `ms3-core-bank-integration.puml` | `CoreSubmission`, `CoreSubmissionDetail`, `ICoreBankGateway` (Anti-Corruption Layer) |
| `ms4-notification.puml` | `NotificationRecord`, `NotificationDispatchService`, `IEmailProvider` |
| `ms5-history-query.puml` | `BatchHistoryView`, `BatchTimelineEvent`, `TransactionHistoryView`, `BatchHistoryProjector` (proyección CQRS) |
| `ms6-audit-logging.puml` | `LogEntry`, `RedactionPolicy`, `LogIngestionService`, `AuditQueryService` |

## 02 — Diagramas de secuencia (`puml/02-sequence-diagrams/`)

| Archivo | Escenario |
|---|---|
| `escenario1-carga-validacion-csv.puml` | Carga y validación de un lote CSV (RF-04, RF-05) |
| `escenario2-flujo-aprobacion.puml` | Flujo maker-checker-authorizer completo, con re-verificación de permisos en cada paso (defense-in-depth) |
| `escenario3-envio-core-bancario.puml` | Envío del lote aprobado al core bancario externo, con reintentos |
| `escenario4-notificacion-correo.puml` | Notificación por correo a beneficiarios tras la aprobación |

## 03 — Diagrama de estados (`puml/03-state-diagrams/`)

| Archivo | Contenido |
|---|---|
| `flujo-aprobacion-maker-checker-authorizer.puml` | Máquina de estados formal del `ApprovalRequest`: 5 estados, 7 transiciones, reglas de segregación de funciones |

## 04 — Arquitectura general (`puml/04-architecture/`)

| Archivo | Contenido |
|---|---|
| `arquitectura-general.puml` | Vista completa del sistema: clientes, API Gateway, OAuth/P2, los 6 microservicios con su BD propia, broker de eventos (Kafka), almacenamiento de CSV, core bancario externo, proveedor de correo |

Renderizado en `rendered/04-architecture/arquitectura-general.svg` / `.png`.

## 05 — Diagrama UML de componentes (`puml/05-component-diagram/`)

| Archivo | Contenido |
|---|---|
| `diagrama-componentes.puml` | Componentes internos vs. externos, interfaces provistas/requeridas (REST y bus de eventos), sin acceso cruzado entre bases de datos |

Renderizado en `rendered/05-component-diagram/diagrama-componentes.svg` / `.png`.

## Pendiente

- **Modelos ER** (formato Mermaid, ya diseñados en conversación, aún no organizados en archivos — ver `er/`, actualmente vacía).
- Documento de descripción técnica de tecnologías y patrones (para el criterio 2.4 de la rúbrica).

## Control de consistencia

Cada vez que se agregan diagramas nuevos, se revisan contra los existentes para detectar microservicios inventados/faltantes, nombres inconsistentes, eventos publicados/consumidos que no coinciden, y accesos indebidos entre bases de datos. El resultado de la revisión más reciente está en [`DIAGRAM-CONSISTENCY-REPORT.md`](./DIAGRAM-CONSISTENCY-REPORT.md).
