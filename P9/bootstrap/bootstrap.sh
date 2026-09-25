#!/usr/bin/env bash
# Punto de entrada único de la reconstrucción (Práctica 9, "Bootstrap de
# día cero"). Ejecutar como:
#
#   ./P9/bootstrap/bootstrap.sh
#
# Orden real (ver P9/docs/bootstrap-diagram.md para el diagrama):
#
#   1. Terraform: crea el namespace de ArgoCD, instala ArgoCD (Helm) y crea
#      el AppProject + la Application raíz (app-of-apps).
#   2. Espera a que ArgoCD reporte los componentes core listos.
#   3. Espera a que la Application raíz (sa-platform-root) quede Synced +
#      Healthy: a partir de ahí, todo lo demás (P8 completo + Velero +
#      base de datos + resiliencia de P9) lo reconstruye ArgoCD solo, sin
#      ningún paso manual adicional.
#
# No maneja: creación del clúster en sí (docker-desktop / minikube /
# clúster gestionado) ni la instalación de Velero fuera del clúster (el
# CLI `velero` y el bucket externo se documentan por separado en
# P9/velero/README.md porque no son recursos de Kubernetes que Terraform
# o ArgoCD deban administrar).
#
# PENDIENTE: este script no se ha ejecutado todavía contra un clúster
# real (ver P9/README.md, sección "Qué está pendiente de pruebas"). Se
# entrega preparado y documentado para la ejecución real posterior a este
# commit.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$SCRIPT_DIR/../terraform"
LOG_FILE="$SCRIPT_DIR/../evidence/reconstruccion-$(date +%Y%m%d-%H%M%S).log"

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "$LOG_FILE"
}

mkdir -p "$SCRIPT_DIR/../evidence"

log "=== INICIO bootstrap Práctica 9 ==="

log "Paso 1/4: terraform init (backend remoto)"
( cd "$TERRAFORM_DIR" && terraform init -backend-config=backend.hcl )

log "Paso 2/4: terraform apply -target=helm_release.argocd (instala ArgoCD antes de que existan los CRD)"
( cd "$TERRAFORM_DIR" && terraform apply -target=helm_release.argocd -auto-approve )

log "Paso 3/4: terraform apply (AppProject + Application raíz, ya con los CRD de ArgoCD disponibles)"
( cd "$TERRAFORM_DIR" && terraform apply -auto-approve )

log "Paso 4/4: esperando a que sa-platform-root quede Synced + Healthy"
kubectl -n argocd wait --for=jsonpath='{.status.sync.status}'=Synced application/sa-platform-root --timeout=600s
kubectl -n argocd wait --for=jsonpath='{.status.health.status}'=Healthy application/sa-platform-root --timeout=600s

log "=== FIN bootstrap: sa-platform-root Synced + Healthy. Registro completo en $LOG_FILE ==="
log "Verificar el resto del sistema con: P9/docs/runbook.md"
