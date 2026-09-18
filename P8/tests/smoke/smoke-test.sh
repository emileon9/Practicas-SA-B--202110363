#!/usr/bin/env bash
# Smoke tests de P8: validan que los endpoints CRITICOS reales de
# sa-platform responden, contra un deploy real (no unit tests -- esos ya
# existen en P5/services/*/tests, agregados en P7). Pensado para correr
# despues de cada step del canary o justo tras un despliegue.
#
# Uso:
#   BASE_URL=http://sa-platform.local bash P8/tests/smoke/smoke-test.sh
#
# Requiere que el Ingress este resuelto a "sa-platform.local" (o se pase
# --resolve/Host como en el resto de P5).
set -uo pipefail

BASE_URL="${BASE_URL:-http://sa-platform.local}"
HOST_HEADER="${HOST_HEADER:-sa-platform.local}"
FAILURES=0

check() {
  local method="$1" path="$2" expected="$3" body="${4:-}"
  local url="${BASE_URL}${path}"
  local code
  if [ -n "$body" ]; then
    code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" \
      -H "Host: ${HOST_HEADER}" -H "Content-Type: application/json" \
      -d "$body" "$url")
  else
    code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" \
      -H "Host: ${HOST_HEADER}" "$url")
  fi
  if [ "$code" = "$expected" ]; then
    echo "OK   $method $path -> $code"
  else
    echo "FAIL $method $path -> $code (esperado $expected)"
    FAILURES=$((FAILURES + 1))
  fi
}

echo "=== Smoke tests: sa-platform (${BASE_URL}) ==="

# GET health de cada componente (endpoint principal de cada servicio).
check GET  "/health"                 200
check GET  "/api/users/health"       200
check GET  "/api/products/health"    200
check GET  "/api/orders/health"      200
check GET  "/api/notifications/health" 200

# GET endpoint de negocio principal de cada REST simple.
check GET  "/api/orders/orders"          200
check GET  "/api/notifications/notifications" 200

# POST endpoint critico real: consultas GraphQL de ms-users/ms-products
# (unico verbo POST real que expone la plataforma, via el gateway).
check POST "/api/users/graphql"    200 '{"query":"{ users { __typename } }"}'
check POST "/api/products/graphql" 200 '{"query":"{ products { __typename } }"}'

echo "=== ${FAILURES} fallo(s) ==="
exit $FAILURES
