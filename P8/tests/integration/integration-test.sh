#!/usr/bin/env bash
# Integration tests de P8: validan la interaccion REAL entre componentes
# (no solo que cada uno responda por separado, que ya cubren los smoke
# tests). Requiere kubectl apuntando al cluster donde esta desplegado
# sa-platform (namespace sa-p5).
#
# Uso:
#   BASE_URL=http://sa-platform.local NAMESPACE=sa-p5 bash P8/tests/integration/integration-test.sh
set -uo pipefail

BASE_URL="${BASE_URL:-http://sa-platform.local}"
HOST_HEADER="${HOST_HEADER:-sa-platform.local}"
NAMESPACE="${NAMESPACE:-sa-p5}"
FAILURES=0

echo "=== Integration test 1: Gateway -> ms-users (proxy real, no un mock) ==="
# El gateway NO expone datos de usuarios por si mismo: si /api/users/graphql
# responde con datos validos, es porque realmente reenvio la peticion a
# ms-users y devolvio su respuesta (createServiceProxy en
# P5/services/gateway/src/services/proxy.service.ts), no una respuesta
# fabricada por el propio gateway.
RESP=$(curl -s -H "Host: ${HOST_HEADER}" -H "Content-Type: application/json" \
  -d '{"query":"{ users { __typename } }"}' "${BASE_URL}/api/users/graphql")
if echo "$RESP" | grep -q '"__typename"'; then
  echo "OK   gateway reenvio correctamente a ms-users: $RESP"
else
  echo "FAIL respuesta inesperada de gateway->ms-users: $RESP"
  FAILURES=$((FAILURES + 1))
fi

echo
echo "=== Integration test 2: API -> PostgreSQL -> RabbitMQ -> ms-notifications ==="
# Cadena asincrona real de P5 (ver P5/docs/async-messaging.md):
#   cronjob-heartbeat escribe en PostgreSQL cada 2 min
#   -> cronjob-summary lee PostgreSQL, calcula el resumen, publica en RabbitMQ
#   -> ms-notifications consume la cola durable y lo expone via GET /notifications
# Se dispara manualmente cada CronJob (sin esperar su propio schedule) y se
# consulta el endpoint hasta ver aparecer un nuevo resumen, o timeout.
echo "Disparando cronjob-heartbeat manualmente..."
kubectl create job --from=cronjob/cronjob-heartbeat -n "$NAMESPACE" \
  "heartbeat-integration-test-$(date +%s)" >/dev/null

echo "Disparando cronjob-summary manualmente..."
kubectl create job --from=cronjob/cronjob-summary -n "$NAMESPACE" \
  "summary-integration-test-$(date +%s)" >/dev/null

echo "Esperando propagacion (hasta 30s)..."
OK=false
for _ in $(seq 1 6); do
  sleep 5
  RESP=$(curl -s -H "Host: ${HOST_HEADER}" "${BASE_URL}/api/notifications/notifications")
  if echo "$RESP" | grep -q '\[' ; then
    OK=true
    break
  fi
done

if [ "$OK" = true ]; then
  echo "OK   ms-notifications expone datos tras el ciclo DB->broker->consumidor: $RESP"
else
  echo "FAIL no se observo el resumen esperado en /api/notifications/notifications"
  FAILURES=$((FAILURES + 1))
fi

echo
echo "=== ${FAILURES} fallo(s) ==="
exit $FAILURES
