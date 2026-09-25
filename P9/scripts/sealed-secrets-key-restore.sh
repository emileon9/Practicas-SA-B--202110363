#!/usr/bin/env bash
# Restaura la llave de Sealed Secrets ANTES de que ArgoCD sincronice
# sa-platform-secrets (sync-wave -2). Ver P9/kubernetes/secrets/README.md.
#
# Uso:
#   ./P9/scripts/sealed-secrets-key-restore.sh /ruta/a/sealed-secrets-key-backup.yaml

set -euo pipefail

BACKUP_FILE="${1:?Uso: sealed-secrets-key-restore.sh <ruta-al-backup>}"

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "ERROR: no existe $BACKUP_FILE" >&2
  exit 1
fi

kubectl apply -f "$BACKUP_FILE"

echo "Reiniciando el controller de Sealed Secrets para que cargue la llave restaurada..."
kubectl delete pod -n kube-system -l app.kubernetes.io/name=sealed-secrets --ignore-not-found

echo "Espera a que el controller vuelva a Ready y luego verifica con:"
echo "  kubectl get secret sa-platform-db-credentials -n sa-p5 -o jsonpath='{.data.DB_PASSWORD}' | base64 -d"
