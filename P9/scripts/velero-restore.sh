#!/usr/bin/env bash
# Prueba de restauración de datos (Práctica 9, "Restauración de datos
# verificada"): elimina los datos actuales del namespace y los restaura
# desde el último backup de Velero, dejando marcas de tiempo para
# calcular el RTO/RPO reales.
#
# Uso:
#   ./P9/scripts/velero-restore.sh <nombre-del-backup>
#
# Si no se indica el backup, usa el registrado por velero-backup.sh en
# P9/evidence/last-backup-name.txt.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_NAME="${1:-$(cat "$SCRIPT_DIR/../evidence/last-backup-name.txt" 2>/dev/null || true)}"
LOG_FILE="$SCRIPT_DIR/../evidence/restore-$(date +%Y%m%d-%H%M%S).log"

if [[ -z "$BACKUP_NAME" ]]; then
  echo "ERROR: no se indicó un backup y no existe P9/evidence/last-backup-name.txt." >&2
  echo "Ejecuta primero P9/scripts/velero-backup.sh o pasa el nombre como argumento." >&2
  exit 1
fi

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "$LOG_FILE"; }

log "=== INICIO prueba de restauración (backup: $BACKUP_NAME) ==="

log "Paso 1: eliminando la marca de prueba de la base de datos (simula pérdida de datos)"
NAMESPACE="sa-p5"
POD="$(kubectl get pod -n "$NAMESPACE" -l app.kubernetes.io/name=postgresql -o jsonpath='{.items[0].metadata.name}')"
kubectl exec -n "$NAMESPACE" "$POD" -- psql -U sa_app -d sa_platform -c "DELETE FROM dr_test_marker;"

log "Paso 2: eliminando el namespace completo (destrucción real, no simulada)"
kubectl delete namespace "$NAMESPACE"
kubectl wait --for=delete namespace/"$NAMESPACE" --timeout=300s || true

log "Paso 3: restaurando desde Velero"
velero restore create "restore-$(date +%Y%m%d-%H%M%S)" \
  --from-backup "$BACKUP_NAME" \
  --wait

log "Paso 4: esperando a que los pods de la base de datos vuelvan a Ready"
kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=postgresql -n "$NAMESPACE" --timeout=300s

log "Paso 5: verificando el contenido restaurado (debe coincidir con la marca sembrada antes del backup)"
POD="$(kubectl get pod -n "$NAMESPACE" -l app.kubernetes.io/name=postgresql -o jsonpath='{.items[0].metadata.name}')"
kubectl exec -n "$NAMESPACE" "$POD" -- psql -U sa_app -d sa_platform -c "SELECT * FROM dr_test_marker;" | tee -a "$LOG_FILE"

log "=== FIN prueba de restauración. Comparar el resultado anterior contra $(cat "$SCRIPT_DIR/../evidence/last-seed-marker.txt" 2>/dev/null || echo 'PENDIENTE: correr db-seed-test-data.sh antes del backup') ==="
log "Registro completo en $LOG_FILE — usar estas marcas de tiempo para P9/docs/dr-report.md"
