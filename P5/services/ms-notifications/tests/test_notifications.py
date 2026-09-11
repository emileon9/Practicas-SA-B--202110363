import os

from fastapi.testclient import TestClient

# BROKER_HOST se deja SIN configurar a proposito: summary_consumer.start()
# revisa esta variable en su hilo de fondo y retorna de inmediato si no
# esta presente (ver app/services/summary_consumer.py), asi que el
# TestClient no necesita RabbitMQ ni PostgreSQL para levantar la app.
os.environ.pop("BROKER_HOST", None)

from app.main import app
from app.services.notifications_service import get_notifications


def test_health_responde_ok():
    with TestClient(app) as client:
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json() == {"status": "ok", "service": "ms-notifications"}


def test_get_notifications_devuelve_lista_no_vacia():
    notifications = get_notifications()
    assert isinstance(notifications, list)
    assert len(notifications) > 0
    for notification in notifications:
        assert isinstance(notification["id"], int)
        assert isinstance(notification["read"], bool)


def test_endpoint_notifications_expone_la_misma_lista():
    with TestClient(app) as client:
        res = client.get("/notifications")
        assert res.status_code == 200
        assert res.json() == get_notifications()
