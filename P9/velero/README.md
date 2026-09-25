# Velero — respaldo y recuperación (Práctica 9)

## Qué gestiona GitOps y qué no

| Recurso | ¿Quién lo aplica? | ¿Por qué |
|---|---|---|
| CRDs de Velero, controller, `ServiceAccount`, `Secret` de credenciales | CLI `velero install` (manual/scriptado, fuera de ArgoCD) | El `Secret` contiene las credenciales del almacenamiento externo; nunca debe versionarse en git, ni siquiera cifrado con un mecanismo distinto al resto del sistema |
| `BackupStorageLocation` (`P9/velero/gitops/backupstoragelocation.yaml`) | ArgoCD (`sa-platform-velero-config`, ver [P9/argocd/applications/velero.yaml](../argocd/applications/velero.yaml)) | Es declarativo, no contiene secretos (solo referencia el nombre del `Secret` ya creado por `velero install`) |
| `Schedule` (`P9/velero/gitops/schedule.yaml`) | ArgoCD | Igual: declarativo, sin secretos |

## Instalación (PENDIENTE de ejecutar — ver `install.sh`)

1. Crear el bucket de almacenamiento externo al clúster (PENDIENTE: nombre
   real del bucket y proveedor — se usará el mismo proveedor de objetos
   que el backend remoto de Terraform, para no introducir una tercera
   cuenta de nube).
2. Generar el archivo de credenciales local (`credentials-velero`, según
   el proveedor) — **nunca commitear este archivo**. Ya está excluido en
   [`.gitignore`](../.gitignore).
3. Ejecutar `P9/velero/install.sh` (documentado, no ejecutado todavía).
4. Verificar con `velero backup-location get` que el `BackupStorageLocation`
   quede `Available`.

## Política de retención declarada

- **Schedule**: `sa-platform-daily` — cron `0 5 * * *` (05:00 UTC, fuera
  del horario de uso del clúster local).
- **TTL de cada backup**: `240h` (10 días) — ver
  `P9/velero/gitops/schedule.yaml`, campo `spec.template.ttl`.
- **Incluye volúmenes persistentes**: sí,
  `spec.template.snapshotVolumes: true` + `defaultVolumesToFsBackup: true`
  (usa Velero File System Backup / Restic-Kopia, no requiere que el
  proveedor de nube soporte snapshots nativos de disco — necesario porque
  el clúster de destino es local, docker-desktop/minikube, sin API de
  snapshot de un proveedor cloud).
- **Namespace respaldado**: `sa-p5` (toda la plataforma, incluida la base
  de datos y sus PVC).
- **Destino**: bucket externo al clúster (`BackupStorageLocation`, ver
  abajo) — nunca dentro del propio clúster.

## Estado real

PENDIENTE — ningún backup se ha ejecutado todavía contra un clúster real.
Los procedimientos de backup y restore están preparados en
[P9/scripts/velero-backup.sh](../scripts/velero-backup.sh) y
[P9/scripts/velero-restore.sh](../scripts/velero-restore.sh) para
ejecutarse después de este commit.
