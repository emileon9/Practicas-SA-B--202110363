# Práctica 9 — Continuidad operativa y recuperación ante desastres

Software Avanzado (USAC) · Carné **202110363**

## 1. Objetivo

Convertir el ecosistema de microservicios entregado en la
[Práctica 8](../P8) — controlado y seguro, pero nunca sometido a una
pérdida real — en un sistema **recuperable y demostrable**: bootstrap de
día cero desde un único punto de entrada, estado de Terraform en backend
remoto, respaldos programados con Velero (incluidos volúmenes
persistentes), continuidad de los secretos tras reconstruir el clúster, y
resiliencia ante la pérdida de un nodo. RTO y RPO se declaran antes de
las pruebas y se contrastan después contra lo medido.

## 2. Arquitectura general de la recuperación

```
Terraform (backend remoto)
  -> instala ArgoCD (Helm)
  -> crea AppProject sa-platform + Application raíz (app-of-apps)
     -> ArgoCD sincroniza:
        - sa-platform-secrets   (SealedSecret DB/broker, sync-wave -2)
        - sa-platform-database  (PostgreSQL StatefulSet + PVC, sync-wave -1)
        - sa-platform-platform  (ConfigMap/NetworkPolicy, sync-wave -1)
        - sa-platform-p8-apps   (los 7 servicios de P8, sync-wave 0)
        - sa-platform-velero-config (Schedule + BackupStorageLocation, sync-wave 2)
```

Diagrama completo, enfocado en el proceso de recuperación (qué se
reconstruye automáticamente, qué depende de respaldos/secretos, qué sigue
siendo manual): **[docs/bootstrap-diagram.md](docs/bootstrap-diagram.md)**.

## 3. Qué se está implementando

| Componente | Carpeta |
|---|---|
| Terraform (backend remoto + instalación de ArgoCD + app-of-apps) | [terraform/](terraform) |
| Punto de entrada único del bootstrap | [bootstrap/bootstrap.sh](bootstrap/bootstrap.sh) |
| Manifiestos de ArgoCD nuevos de P9 (base de datos, Velero, puente hacia P8) | [argocd/applications/](argocd/applications) |
| Configuración de Velero (Schedule, retención, BackupStorageLocation) | [velero/](velero) |
| Base de datos con PVC real (gap detectado en P8, ver comentarios en el manifiesto) | [kubernetes/database/postgres.yaml](kubernetes/database/postgres.yaml) |
| Continuidad de la llave de Sealed Secrets | [kubernetes/secrets/](kubernetes/secrets) |
| Resiliencia ante pérdida de nodo (anti-afinidad agregada a los charts de P8, PDB/réplicas/probes que P8 ya tenía) | [kubernetes/resilience/README.md](kubernetes/resilience/README.md) |
| Scripts de prueba (seed, backup, restore, drain, respaldo de llave) | [scripts/](scripts) |
| Runbook, informe de DR, diagrama | [docs/](docs) |

## 4. Cómo se realizará la recuperación

Un único comando reconstruye el sistema completo a partir de un clúster
vacío: `./P9/bootstrap/bootstrap.sh` (ver
[docs/runbook.md, sección 1](docs/runbook.md#1-cómo-iniciar-el-bootstrap)).
Terraform instala ArgoCD y crea la `Application` raíz; a partir de ahí,
ArgoCD reconstruye todo lo demás sin pasos manuales adicionales, salvo
los tres que **no pueden** automatizarse sin exponer un secreto en el
repositorio (restaurar la llave de Sealed Secrets, instalar Velero con
las credenciales del bucket externo, y aplicar RabbitMQ — decisión ya
tomada en P8, ver [docs/bootstrap-diagram.md](docs/bootstrap-diagram.md)).

## 5. Qué ya está implementado

- Estructura completa de Terraform (providers, variables, instalación de
  ArgoCD vía Helm, AppProject + Application raíz), con backend remoto
  `gcs` declarado (bucket pendiente de crear).
- Los 10 manifiestos de `Application` del app-of-apps (1 raíz + 1 puente
  a P8 + database + velero-config; los 9 de P8 se reutilizan sin
  modificarlos).
- `PostgreSQL` como `StatefulSet` + `PersistentVolumeClaim` real — antes
  de esta práctica, el Service que consumían los microservicios
  (`sa-postgresql`) no tenía ningún manifiesto versionado (ver el
  comentario de cabecera en
  [kubernetes/database/postgres.yaml](kubernetes/database/postgres.yaml)).
- Anti-afinidad de Pods agregada a los 5 charts de Deployment/Rollout de
  P8 (`gateway`, `ms-users`, `ms-products`, `ms-orders`,
  `ms-notifications`); los `PodDisruptionBudget`, las 2 réplicas por
  servicio y las probes ya existían desde P8.
- `Schedule` y `BackupStorageLocation` de Velero, declarativos.
- Scripts completos para: sembrar datos de prueba, backup manual,
  restauración con verificación, drenaje de nodo, y respaldo/restauración
  de la llave de Sealed Secrets.
- Runbook (12 pasos, comandos concretos) y diagrama del proceso de
  recuperación.

## 6. Qué está preparado pero pendiente de ejecución/pruebas

- `terraform apply` real contra un clúster (requiere el bucket del
  backend remoto y un clúster corriendo — ninguno de los dos existe en
  este momento, igual que P8 lo documentó honestamente en su propio
  README).
- Instalación real de Velero (requiere el bucket externo y el archivo de
  credenciales, nunca versionados).
- Ejecución del bootstrap completo, medición del RTO real.
- Prueba de restauración de datos, medición del RPO real.
- Prueba de pérdida de nodo (requiere un clúster de ≥2 nodos; no es
  posible demostrarla en un clúster local de un solo nodo — ver
  `scripts/node-drain-test.sh`).
- Respaldo/restauración real de la llave de Sealed Secrets.
- `docs/dr-report.md`: los seis campos de la plantilla están preparados
  con placeholders `PENDIENTE` / `PENDIENTE DE PRUEBA` — se completan con
  datos reales después de ejecutar las pruebas anteriores.
- Video demostrativo.

## 7. Instrucciones iniciales de ejecución

```bash
# 1. Configurar el backend remoto de Terraform
cd P9/terraform
cp backend.hcl.example backend.hcl        # completar con el bucket real
cp terraform.tfvars.example terraform.tfvars

# 2. Ejecutar el bootstrap completo
cd ../..
./P9/bootstrap/bootstrap.sh

# 3. Verificar cada componente
# Ver P9/docs/runbook.md, secciones 2-11 (comandos concretos por componente)
```

## 8. Tabla de enlaces obligatoria

| Ítem | Enlace o dato requerido |
|---|---|
| Repositorio GitOps | https://github.com/emileon9/practica8-gitops |
| Aplicación raíz en ArgoCD | `sa-platform-root`, namespace `argocd` (ver [terraform/argocd.tf](terraform/argocd.tf)) |
| Punto de entrada del bootstrap | [`P9/bootstrap/bootstrap.sh`](bootstrap/bootstrap.sh) |
| Backend remoto de Terraform | Tipo: `gcs` (Google Cloud Storage) — ubicación (nombre de bucket): **PENDIENTE**, ver [terraform/backend.hcl.example](terraform/backend.hcl.example) |
| Schedule de Velero | `sa-platform-daily` (ver [velero/gitops/schedule.yaml](velero/gitops/schedule.yaml)) — destino: `BackupStorageLocation sa-platform-default`, bucket **PENDIENTE** (ver [velero/gitops/backupstoragelocation.yaml](velero/gitops/backupstoragelocation.yaml)) |
| Reconstrucción cronometrada | **PENDIENTE** — se generará en `P9/evidence/reconstruccion-<fecha>.log` al ejecutar `bootstrap.sh` |
| Restauración de datos | **PENDIENTE** — se generará en `P9/evidence/restore-<fecha>.log` al ejecutar `scripts/velero-restore.sh` |
| Prueba de pérdida de nodo | **PENDIENTE** — se generará en `P9/evidence/node-drain-<fecha>.log` al ejecutar `scripts/node-drain-test.sh` |
| RTO y RPO declarados | **PENDIENTE** — ver [docs/dr-report.md](docs/dr-report.md) |
| Video demostrativo | **PENDIENTE** |

## 9. Verificación de limpieza del repositorio

Antes de cada commit de esta práctica:

```bash
# Ningún archivo de estado de Terraform
git status --porcelain P9/terraform | grep tfstate   # debe no imprimir nada

# Ninguna credencial ni backend.hcl real
git status --porcelain P9 | grep -E 'backend\.hcl$|credentials-velero|tfvars$|sealed-secrets-key-backup\.yaml'
# debe no imprimir nada (todo excluido por P9/.gitignore)

# Revisión manual de contenido antes de un `git add` amplio
git diff --stat P9
```
