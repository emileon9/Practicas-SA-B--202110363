#!/usr/bin/env bash
# Inserta datos de prueba verificables en PostgreSQL, para la prueba de
# restauración (Práctica 9, "Restauración de datos verificada").
#
# Usa la tabla real de ms-orders (no una tabla inventada): PENDIENTE
# confirmar el nombre exacto de la tabla contra el esquema real de
# P5/services/ms-orders antes de ejecutar (no se afirma aquí sin haberlo
# verificado contra el código del servicio).
#
# Uso:
#   ./P9/scripts/db-seed-test-data.sh

set -euo pipefail

NAMESPACE="sa-p5"
POD="$(kubectl get pod -n "$NAMESPACE" -l app.kubernetes.io/name=postgresql -o jsonpath='{.items[0].metadata.name}')"
MARKER="dr-test-$(date +%s)"

echo "Insertando marca de prueba: $MARKER"

kubectl exec -n "$NAMESPACE" "$POD" -- psql -U sa_app -d sa_platform -c \
  "CREATE TABLE IF NOT EXISTS dr_test_marker (id serial PRIMARY KEY, marker text NOT NULL, created_at timestamptz DEFAULT now());"

kubectl exec -n "$NAMESPACE" "$POD" -- psql -U sa_app -d sa_platform -c \
  "INSERT INTO dr_test_marker (marker) VALUES ('$MARKER');"

echo "Verificación inmediata:"
kubectl exec -n "$NAMESPACE" "$POD" -- psql -U sa_app -d sa_platform -c \
  "SELECT * FROM dr_test_marker ORDER BY id DESC LIMIT 5;"

echo "$MARKER" > "$(dirname "$0")/../evidence/last-seed-marker.txt"
echo "Marca guardada en P9/evidence/last-seed-marker.txt para verificarla después de la restauración."
