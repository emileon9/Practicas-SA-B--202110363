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
# Cada CronJob se dispara a mano y se EXIGE que termine en exito. Una
# version anterior de esta prueba solo comprobaba que /notifications
# devolviera un arreglo JSON, cosa que ocurre incluso con los datos de
# ejemplo en memoria: pasaba siempre, aun con PostgreSQL caido o con las
# credenciales mal. Comprobar el estado de los Jobs es lo que realmente
# ejercita la cadena.
HB="heartbeat-integration-test-$(date +%s)"
SM="summary-integration-test-$(date +%s)"

echo "Disparando cronjob-heartbeat (escribe en PostgreSQL)..."
kubectl create job --from=cronjob/cronjob-heartbeat -n "$NAMESPACE" "$HB" >/dev/null

if kubectl wait --for=condition=complete "job/$HB" -n "$NAMESPACE" --timeout=90s >/dev/null 2>&1; then
  echo "OK   cronjob-heartbeat escribio en PostgreSQL"
else
  echo "FAIL cronjob-heartbeat no completo (DB inaccesible o credenciales incorrectas):"
  kubectl logs -n "$NAMESPACE" "job/$HB" --tail=3 2>&1 | sed 's/^/       /'
  FAILURES=$((FAILURES + 1))
fi

echo "Disparando cronjob-summary (lee PostgreSQL y publica en RabbitMQ)..."
kubectl create job --from=cronjob/cronjob-summary -n "$NAMESPACE" "$SM" >/dev/null

if kubectl wait --for=condition=complete "job/$SM" -n "$NAMESPACE" --timeout=90s >/dev/null 2>&1; then
  echo "OK   cronjob-summary publico el resumen en el broker"
else
  echo "FAIL cronjob-summary no completo (DB o broker inaccesibles):"
  kubectl logs -n "$NAMESPACE" "job/$SM" --tail=3 2>&1 | sed 's/^/       /'
  FAILURES=$((FAILURES + 1))
fi

echo "Consultando el consumidor..."
RESP=$(curl -s -H "Host: ${HOST_HEADER}" "${BASE_URL}/api/notifications/notifications")
if echo "$RESP" | grep -q '\['; then
  echo "OK   ms-notifications responde: $RESP"
else
  echo "FAIL respuesta inesperada de ms-notifications: $RESP"
  FAILURES=$((FAILURES + 1))
fi

echo
echo "=== ${FAILURES} fallo(s) ==="
exit $FAILURES
