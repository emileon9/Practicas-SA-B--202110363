#!/usr/bin/env bash
# Respalda la llave privada activa del controller de Sealed Secrets.
# Ver P9/kubernetes/secrets/README.md para el procedimiento completo.
#
# El archivo generado (sealed-secrets-key-backup.yaml) NUNCA debe
# commitearse: ya está excluido en P9/.gitignore. Debe copiarse a un
# almacenamiento externo (el mismo bucket de Velero, o un gestor de
# secretos aparte) fuera de este repositorio.

set -euo pipefail

OUT_FILE="$(dirname "$0")/sealed-secrets-key-backup.yaml"

kubectl get secret -n kube-system \
  -l sealedsecrets.bitnami.com/sealed-secrets-key \
  -o yaml > "$OUT_FILE"

echo "Llave respaldada en: $OUT_FILE"
echo "IMPORTANTE: mueve este archivo fuera del repositorio (bucket externo, no git)."
