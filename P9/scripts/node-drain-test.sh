#!/usr/bin/env bash
# Prueba de pérdida de nodo (Práctica 9, "Resiliencia ante pérdida de
# nodo"): drena un nodo mientras un loop de peticiones al servicio
# demuestra que sigue respondiendo.
#
# PENDIENTE: en un clúster de un solo nodo (docker-desktop/minikube) este
# script no puede demostrar nada útil (drenar el único nodo apaga todo el
# clúster). Requiere un clúster de al menos 2 nodos — ver P9/README.md,
# sección "Qué está pendiente de pruebas".
#
# Uso:
#   ./P9/scripts/node-drain-test.sh <nombre-del-nodo> <url-del-servicio>

set -euo pipefail

NODE="${1:?Uso: node-drain-test.sh <nombre-del-nodo> <url-del-servicio>}"
SERVICE_URL="${2:?Uso: node-drain-test.sh <nombre-del-nodo> <url-del-servicio>}"
LOG_FILE="$(dirname "$0")/../evidence/node-drain-$(date +%Y%m%d-%H%M%S).log"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "$LOG_FILE"; }

log "=== INICIO prueba de pérdida de nodo: $NODE ==="

# Loop de verificación en segundo plano: una petición por segundo durante
# todo el drenaje, registrando éxito/fallo con marca de tiempo.
(
  while true; do
    STATUS=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$SERVICE_URL" || echo "ERROR")
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $SERVICE_URL -> $STATUS" >> "$LOG_FILE"
    sleep 1
  done
) &
LOOP_PID=$!

log "Drenando nodo $NODE"
kubectl drain "$NODE" --ignore-daemonsets --delete-emptydir-data --timeout=180s

log "Nodo drenado. Deteniendo el loop de verificación."
kill "$LOOP_PID" 2>/dev/null || true

log "Descomentar para devolver el nodo al pool de scheduling:"
log "  kubectl uncordon $NODE"

FAILURES=$(grep -c "ERROR\|50[0-9]" "$LOG_FILE" || true)
log "=== FIN prueba de pérdida de nodo. Peticiones fallidas durante el drenaje: $FAILURES ==="
log "Registro completo en $LOG_FILE — usar para P9/docs/dr-report.md, sección 'Puntos únicos de fallo detectados'"
