# Runbook de recuperación — sa-platform (Práctica 9)

Este documento está escrito para que una persona **sin conocimiento
previo del sistema** pueda ejecutar la recuperación completa, sin acceso
al autor. Cada paso incluye el comando exacto y cómo verificar que
funcionó antes de continuar al siguiente.

> Convención: los bloques marcados `PENDIENTE` indican un valor que debe
> completarse antes de la primera ejecución real contra un clúster
> (nombre de bucket, versión de chart verificada, etc.) — ver
> `P9/README.md` para el estado actual de cada uno.

## 0. Prerrequisitos

| Herramienta | Versión mínima | Verificar con |
|---|---|---|
| `kubectl` | v1.28+ | `kubectl version --client` |
| `terraform` | v1.5+ | `terraform version` |
| `helm` | v3.x | `helm version` |
| CLI `argocd` | v2.x | `argocd version --client` |
| CLI `velero` | v1.14+ | `velero version --client-only` |
| Acceso al clúster de destino | — | `kubectl cluster-info` |
| Archivo de credenciales de Velero | — | ver `P9/velero/README.md` (nunca en git) |
| Backup de la llave de Sealed Secrets | — | ver `P9/kubernetes/secrets/README.md` (nunca en git) |

## 1. Cómo iniciar el bootstrap

Punto de entrada único (Práctica 9, requisito "Bootstrap de día cero"):

```bash
cd P9/terraform
cp backend.hcl.example backend.hcl   # completar con el bucket real
cp terraform.tfvars.example terraform.tfvars  # ajustar si aplica

cd ../..
./P9/bootstrap/bootstrap.sh
```

El script registra cada paso con marca de tiempo en
`P9/evidence/reconstruccion-<fecha>.log` — ese archivo es la evidencia
de la reconstrucción cronometrada (RTO).

## 2. Cómo verificar Terraform

```bash
cd P9/terraform
terraform state list
# Esperado: kubernetes_namespace.argocd, helm_release.argocd,
# kubernetes_manifest.sa_platform_project, kubernetes_manifest.sa_platform_root

terraform show | grep -A2 'namespace ='
```

Confirmar que **no** existe ningún `*.tfstate` en el repositorio:

```bash
git status --ignored -- P9/terraform | grep tfstate
# No debe listar ningun archivo trackeado (solo ignorados, si los hay localmente)
```

## 3. Cómo verificar ArgoCD

```bash
kubectl get pods -n argocd
kubectl get application -n argocd
# Esperado: sa-platform-root, sa-platform-p8-apps, sa-platform-database,
# sa-platform-velero-config, y los 9 de P8 (gateway, ms-*, cronjob-*,
# platform, secrets) — todos Synced + Healthy

kubectl port-forward svc/argocd-server -n argocd 8080:443
# UI en https://localhost:8080 — usuario admin, password inicial:
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' | base64 -d
```

## 4. Cómo verificar las aplicaciones (microservicios)

```bash
kubectl get pods -n sa-p5
kubectl get deployment,rollout -n sa-p5

# Smoke test real, reutilizado de P8 (P8/tests/smoke/smoke-test.sh)
bash P8/tests/smoke/smoke-test.sh
```

## 5. Cómo verificar la base de datos

```bash
kubectl get statefulset,pvc -n sa-p5 -l app.kubernetes.io/name=postgresql
kubectl exec -n sa-p5 "$(kubectl get pod -n sa-p5 -l app.kubernetes.io/name=postgresql -o jsonpath='{.items[0].metadata.name}')" \
  -- pg_isready -U sa_app -d sa_platform
```

## 6. Cómo verificar secretos

```bash
# Debe imprimir la contraseña real, no un error de descifrado
kubectl get secret sa-platform-db-credentials -n sa-p5 \
  -o jsonpath='{.data.DB_PASSWORD}' | base64 -d

kubectl get sealedsecret -n sa-p5
```

Si tras una reconstrucción completa este comando falla o devuelve vacío,
significa que la llave de Sealed Secrets no se restauró antes del sync de
`sa-platform-secrets` — ejecutar
`P9/scripts/sealed-secrets-key-restore.sh` (ver sección 9 del
[diagrama de bootstrap](bootstrap-diagram.md)) y forzar un nuevo sync:

```bash
kubectl -n argocd patch application sa-platform-p8-apps \
  --type merge -p '{"operation":{"sync":{}}}'
```

## 7. Cómo verificar Velero

```bash
velero backup-location get
# Esperado: sa-platform-default -> Available

velero schedule get
# Esperado: sa-platform-daily -> cron "0 5 * * *"

velero backup get
```

## 8. Cómo restaurar (datos)

```bash
# 1. Sembrar datos de prueba y respaldar
./P9/scripts/db-seed-test-data.sh
./P9/scripts/velero-backup.sh

# 2. Eliminar y restaurar (el script hace ambas cosas y registra tiempos)
./P9/scripts/velero-restore.sh
```

## 9. Cómo validar los datos

```bash
kubectl exec -n sa-p5 "$(kubectl get pod -n sa-p5 -l app.kubernetes.io/name=postgresql -o jsonpath='{.items[0].metadata.name}')" \
  -- psql -U sa_app -d sa_platform -c "SELECT * FROM dr_test_marker;"
```

Comparar el resultado contra `P9/evidence/last-seed-marker.txt` (marca
sembrada antes del backup). Coincidencia exacta = restauración
verificada con contenido real, no un volumen vacío.

## 10. Cómo probar pérdida de nodo

```bash
kubectl get nodes
./P9/scripts/node-drain-test.sh <nombre-del-nodo> http://<url-del-gateway>/health
```

PENDIENTE: requiere un clúster de al menos 2 nodos (ver script para el
detalle de por qué un clúster de un solo nodo no permite esta prueba).

## 11. Cómo verificar que el sistema quedó operativo

```bash
bash P8/tests/smoke/smoke-test.sh
bash P8/tests/integration/integration-test.sh
kubectl get application -n argocd -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.sync.status}{"\t"}{.status.health.status}{"\n"}{end}'
```

Todas las `Application` deben quedar `Synced` + `Healthy`, y ambos
scripts de prueba deben terminar sin error, antes de dar por concluida
la recuperación.

## 12. Si algo falla

| Síntoma | Causa probable | Acción |
|---|---|---|
| `terraform apply` falla en `kubernetes_manifest.sa_platform_project` con error de CRD no encontrado | Se corrió `terraform apply` completo antes de que ArgoCD terminara de instalar sus CRD | Repetir el `apply -target=helm_release.argocd` de la sección 1 y esperar a que termine antes del segundo `apply` |
| `sa-platform-secrets` queda `Degraded` | Llave de Sealed Secrets no restaurada | Ver sección 6 |
| `sa-platform-velero-config` queda `Unknown`/`Missing` | Velero no instalado todavía | Ejecutar `P9/velero/install.sh` antes |
| PVC de PostgreSQL en `Pending` | El clúster de destino no tiene `StorageClass` por defecto | Fijar `storageClassName` explícito en `P9/kubernetes/database/postgres.yaml` |
