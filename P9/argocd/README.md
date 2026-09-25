# ArgoCD — app-of-apps de la Práctica 9

`applications/` contiene el segundo nivel del app-of-apps (el nivel raíz,
`sa-platform-root`, se crea por Terraform en
[../terraform/argocd.tf](../terraform/argocd.tf) y apunta a esta misma
carpeta).

| Archivo | Application | Qué sincroniza |
|---|---|---|
| [applications/p8-apps.yaml](applications/p8-apps.yaml) | `sa-platform-p8-apps` | Los 9 `Application` ya existentes de la Práctica 8 (`P8/argocd/applications/`), sin modificarlos |
| [applications/database.yaml](applications/database.yaml) | `sa-platform-database` | `P9/kubernetes/database/` (PostgreSQL con PVC) |
| [applications/velero.yaml](applications/velero.yaml) | `sa-platform-velero-config` | `P9/velero/gitops/` (Schedule + BackupStorageLocation, sin credenciales) |

Ver el orden completo de sincronización (sync-waves) en
[../docs/bootstrap-diagram.md](../docs/bootstrap-diagram.md).
