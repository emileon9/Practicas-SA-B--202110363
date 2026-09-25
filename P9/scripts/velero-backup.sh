#!/usr/bin/env bash
# Ejecuta un backup manual con Velero (además del Schedule programado) y
# registra la marca de tiempo, para poder calcular el RPO real.
#
# Uso:
#   ./P9/scripts/velero-backup.sh

set -euo pipefail

BACKUP_NAME="sa-platform-manual-$(date +%Y%m%d-%H%M%S)"
LOG_FILE="$(dirname "$0")/../evidence/backup-$(date +%Y%m%d-%H%M%S).log"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] INICIO backup $BACKUP_NAME" | tee -a "$LOG_FILE"

velero backup create "$BACKUP_NAME" \
  --include-namespaces sa-p5 \
  --storage-location sa-platform-default \
  --wait

velero backup describe "$BACKUP_NAME" | tee -a "$LOG_FILE"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] FIN backup $BACKUP_NAME" | tee -a "$LOG_FILE"
echo "$BACKUP_NAME" > "$(dirname "$0")/../evidence/last-backup-name.txt"
