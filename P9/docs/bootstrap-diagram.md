# Diagrama del bootstrap — proceso de recuperación (Práctica 9)

Este diagrama muestra el **orden de reconstrucción y las dependencias**
entre componentes al ejecutar `P9/bootstrap/bootstrap.sh` sobre un
clúster completamente destruido — no es un diagrama de arquitectura
general (ese ya existe en [P8/docs/gitops-flow.md](../../P8/docs/gitops-flow.md)).

```mermaid
flowchart TD
    Start(["Estudiante ejecuta\nP9/bootstrap/bootstrap.sh\n(ÚNICO comando manual)"])

    Start --> TF1["Terraform apply -target=helm_release.argocd\n(namespace argocd + Helm install ArgoCD)"]
    TF1 --> TF2["Terraform apply\n(AppProject sa-platform + Application raíz\nsa-platform-root)"]
    TF2 --> Root["ArgoCD sincroniza sa-platform-root\n(app-of-apps, sync-wave por defecto)"]

    Root --> Secrets["sync-wave -2\nsa-platform-secrets\n(SealedSecret DB/broker)"]
    Secrets -->|"requiere llave de Sealed Secrets\nrestaurada ANTES de este paso"| SecretsManual["MANUAL, fuera del app-of-apps:\nP9/scripts/sealed-secrets-key-restore.sh"]

    Root --> DB["sync-wave -1\nsa-platform-database\n(StatefulSet + PVC PostgreSQL)"]
    Root --> Platform["sync-wave -1\nsa-platform-platform\n(ConfigMap + NetworkPolicy)"]

    Secrets --> P8Apps
    DB --> P8Apps
    Platform --> P8Apps

    Root --> P8Apps["sync-wave 0\nsa-platform-p8-apps\n(app-of-apps intermedio, sin cambios)"]
    P8Apps --> Gateway["gateway (Rollout)"]
    P8Apps --> Users["ms-users"]
    P8Apps --> Products["ms-products"]
    P8Apps --> Orders["ms-orders"]
    P8Apps --> Notifications["ms-notifications"]
    P8Apps --> CronHB["cronjob-heartbeat"]
    P8Apps --> CronSum["cronjob-summary"]

    Root --> Velero["sync-wave 2\nsa-platform-velero-config\n(Schedule + BackupStorageLocation)"]
    Velero -->|"requiere Velero instalado\nANTES de este paso"| VeleroManual["MANUAL, fuera del app-of-apps:\nP9/velero/install.sh\n(credenciales del bucket externo)"]

    RabbitMQ["MANUAL, fuera del app-of-apps:\nkubectl apply -f P8/platform/rabbitmq.yaml\n(igual que en P8, nunca migrado a Helm/ArgoCD)"]

    classDef auto fill:#2f6f4f,color:#fff,stroke:#1c4531;
    classDef manual fill:#8a4b08,color:#fff,stroke:#5c3205;
    classDef gate fill:#1f3a5f,color:#fff,stroke:#13253d;

    class Start,SecretsManual,VeleroManual,RabbitMQ manual;
    class TF1,TF2,Root,Secrets,DB,Platform,P8Apps,Gateway,Users,Products,Orders,Notifications,CronHB,CronSum,Velero auto;
```

## Qué se reconstruye automáticamente

Todo lo que cuelga de `sa-platform-root`: ArgoCD sincroniza la base de
datos, la plataforma compartida, los 7 componentes de P8 y la
configuración de Velero sin ningún `kubectl apply` manual, en el orden
que fijan los `sync-wave` (secretos → base de datos/plataforma →
servicios → configuración de Velero).

## Qué depende de respaldos

- **Datos de PostgreSQL**: el `PersistentVolumeClaim` se recrea vacío;
  el contenido real solo vuelve si se ejecuta
  `P9/scripts/velero-restore.sh` contra un backup existente.

## Qué depende de secretos

- **`sa-platform-secrets`** (sync-wave `-2`): los `SealedSecret` del
  repositorio GitOps son ilegibles a menos que la llave privada del
  controller se haya restaurado primero (ver
  [P9/kubernetes/secrets/README.md](../kubernetes/secrets/README.md)).

## Qué pasos siguen siendo manuales (y por qué)

| Paso manual | Por qué no se automatizó con Terraform/ArgoCD |
|---|---|
| `P9/scripts/sealed-secrets-key-restore.sh` | Requiere el archivo de la llave privada, que nunca vive en git |
| `P9/velero/install.sh` | Requiere el archivo de credenciales del almacenamiento externo, que nunca vive en git |
| `kubectl apply -f P8/platform/rabbitmq.yaml` | Decisión ya tomada en P8 (ver `P8/platform/rabbitmq.yaml`, comentario de cabecera): infraestructura previa a la aplicación, fuera del flujo de las Applications; P9 no cambia esa decisión, solo la documenta explícitamente en este diagrama |

El punto de entrada único (`bootstrap.sh`) automatiza todo lo que puede
automatizarse sin exponer un secreto en el repositorio; los tres pasos
manuales de la tabla están documentados en el runbook
([P9/docs/runbook.md](runbook.md)) con el comando exacto de cada uno.
