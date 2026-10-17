import os
from unittest.mock import AsyncMock, patch

# Debe fijarse ANTES de importar app.main: OTEL_SDK_DISABLED es la
# variable estandar de OpenTelemetry (ver app/observability/tracing.py)
# que evita que los tests intenten conectar de verdad a un Collector.
os.environ.setdefault("OTEL_SDK_DISABLED", "true")

from fastapi.testclient import TestClient

from app.main import app
from app.services.orders_service import get_orders

client = TestClient(app)


def test_health_responde_ok():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "service": "ms-orders"}


def test_get_orders_devuelve_lista_no_vacia():
    orders = get_orders()
    assert isinstance(orders, list)
    assert len(orders) > 0
    for order in orders:
        assert isinstance(order["id"], int)
        assert order["status"] in {"pending", "shipped", "delivered"}


def test_endpoint_orders_incluye_userName_de_ms_users():
    """Practica 10: /orders ahora enriquece cada pedido con el nombre del
    usuario, consultado a ms-users (ver app/services/users_client.py). Se
    mockea fetch_user_name para que el test siga siendo hermetico (sin
    depender de que ms-users este corriendo de verdad)."""
    with patch(
        "app.services.orders_service.fetch_user_name",
        new=AsyncMock(return_value="Usuario de Prueba"),
    ):
        res = client.get("/orders")
        assert res.status_code == 200
        body = res.json()
        assert len(body) == len(get_orders())
        for order in body:
            assert order["userName"] == "Usuario de Prueba"


def test_endpoint_orders_no_falla_si_ms_users_no_responde():
    """Resiliencia (Practica 10): si ms-users no responde, /orders sigue
    devolviendo los pedidos, solo sin userName -- no debe propagar la
    falla de un servicio secundario al cliente final."""
    with patch(
        "app.services.orders_service.fetch_user_name",
        new=AsyncMock(return_value=None),
    ):
        res = client.get("/orders")
        assert res.status_code == 200
        assert all(order["userName"] is None for order in res.json())
