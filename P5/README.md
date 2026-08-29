# Práctica 5 — Orquestación avanzada de microservicios en Kubernetes con Helm

Software Avanzado (USAC) · Carné **202110363**

Lleva los 4 microservicios + API Gateway de la [Práctica 4](../P4) a un
clúster de Kubernetes administrado por un **único chart de Helm**
(`sa-platform`), agregando persistencia durable (PostgreSQL), mensajería
asíncrona (RabbitMQ), aislamiento de red, RBAC de mínimo privilegio,
autoescalado y dos CronJobs encadenados.

Toda la plataforma se instala, actualiza y revierte **exclusivamente** con
`helm install` / `helm upgrade` / `helm rollback` — nunca con
`kubectl apply -f` — en el namespace `sa-p5`, creado por el propio chart.

## Estructura

```
P5/
├── services/                   Codigo fuente de los 4 microservicios + gateway
│   ├── gateway/                (Node/TS, heredado de P4)
│   ├── ms-users/                (Node/TS, heredado de P4)
│   ├── ms-products/             (Node/TS, heredado de P4)
│   ├── ms-orders/                (Python/FastAPI, heredado de P4)
│   └── ms-notifications/         (Python/FastAPI, heredado de P4 + consumidor RabbitMQ)
├── jobs/                        Codigo fuente de los CronJobs
│   ├── cronjob-heartbeat/        CronJob 1: inserta fecha GMT-6 + carne cada 2 min
│   └── cronjob-summary/          CronJob 2: resume y publica en el broker cada 10 min
├── charts/sa-platform/          Chart de Helm (padre + subcharts + dependencias)
├── scripts/load-test/           Script de carga k6
├── docs/                        Documentacion tecnica y evidencias
└── README.md                    Este archivo
```

## Quickstart

Ver el procedimiento completo, reproducible desde un clúster vacío, en
**[docs/deployment.md](docs/deployment.md)**.

```bash
cd P5/charts/sa-platform
helm dependency update .
cp values.example.yaml values-secrets.yaml   # editar con contraseñas reales
helm install sa-platform . -n sa-p5 -f values-dev.yaml -f values-secrets.yaml
```

## Documentación

| Documento | Contenido |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Diagrama, componentes internos/externos, flujo síncrono y asíncrono |
| [docs/deployment.md](docs/deployment.md) | Comandos reproducibles: clúster vacío → plataforma funcionando, upgrade, rollback |
| [docs/networking.md](docs/networking.md) | Ingress, NetworkPolicies, procedimiento de evidencia de bloqueo |
| [docs/persistence.md](docs/persistence.md) | StatefulSet + PVC, procedimiento de evidencia de persistencia |
| [docs/async-messaging.md](docs/async-messaging.md) | RabbitMQ, flujo productor/consumidor, evidencia de no pérdida de mensajes |
| [docs/security.md](docs/security.md) | RBAC, securityContext, tabla de tamaño de imágenes, justificación de probes |
| [docs/load-testing.md](docs/load-testing.md) | HPA, metrics-server, cómo correr k6 y capturar el escalado |
| [docs/evidence.md](docs/evidence.md) | Plantilla para pegar las salidas reales de cada prueba |
| [docs/theoretical-questions.md](docs/theoretical-questions.md) | Preguntas teóricas del enunciado (a responder por el estudiante) |

## Stack

- **Kubernetes local**: Docker Desktop Kubernetes.
- **Helm**: 3.20.0.
- **Broker**: RabbitMQ (dependencia Bitnami).
- **Base de datos**: PostgreSQL (dependencia Bitnami).
- **Ingress Controller**: NGINX.
- **Pruebas de carga**: k6.
- **Lenguajes heredados de P4**: Node.js/TypeScript (gateway, ms-users,
  ms-products) y Python/FastAPI (ms-orders, ms-notifications) — los
  CronJobs también son Python.
