#!/usr/bin/env bash
# Instalación de Velero (fuera de ArgoCD a propósito: requiere el Secret
# de credenciales del almacenamiento externo, que nunca debe vivir en
# git). Ver P9/velero/README.md.
#
# PENDIENTE: completar BUCKET_NAME y PROVIDER, y generar
# credentials-velero (ruta abajo) antes de ejecutar. Este script no se ha
# corrido todavía contra un clúster real.

set -euo pipefail

PROVIDER="${VELERO_PROVIDER:-PENDIENTE-gcp-o-aws}"
BUCKET_NAME="${VELERO_BUCKET:-PENDIENTE-nombre-del-bucket}"
BUCKET_REGION="${VELERO_REGION:-PENDIENTE-region}"
CREDENTIALS_FILE="${VELERO_CREDENTIALS_FILE:-$(dirname "$0")/credentials-velero}"

if [[ ! -f "$CREDENTIALS_FILE" ]]; then
  echo "ERROR: no existe $CREDENTIALS_FILE. Genera las credenciales del" >&2
  echo "proveedor de almacenamiento de objetos antes de continuar. Nunca" >&2
  echo "commitees este archivo (ya está en .gitignore)." >&2
  exit 1
fi

velero install \
  --provider "$PROVIDER" \
  --bucket "$BUCKET_NAME" \
  --backup-location-config region="$BUCKET_REGION" \
  --secret-file "$CREDENTIALS_FILE" \
  --use-node-agent \
  --default-volumes-to-fs-backup \
  --wait

echo "Velero instalado. Verificar con: velero backup-location get"
