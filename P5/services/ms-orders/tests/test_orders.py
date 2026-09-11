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


def test_endpoint_orders_expone_la_misma_lista():
    res = client.get("/orders")
    assert res.status_code == 200
    assert res.json() == get_orders()
