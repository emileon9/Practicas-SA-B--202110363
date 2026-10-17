from app.observability.metrics import orders_by_status_total
from app.services.users_client import fetch_user_name

orders = [
    {"id": 1, "userId": 1, "product": "Teclado mecanico", "quantity": 1, "status": "pending"},
    {"id": 2, "userId": 2, "product": "Mouse inalambrico", "quantity": 2, "status": "shipped"},
    {"id": 3, "userId": 3, "product": "Monitor 24 pulgadas", "quantity": 1, "status": "delivered"},
]


def get_orders():
    """Datos crudos, sin llamadas de red -- se mantiene sincrona y pura a
    proposito para que siga siendo trivial de probar (ver tests/test_orders.py)."""
    return orders


async def get_orders_enriched():
    """Practica 10: cada orden con el nombre real del usuario que la hizo,
    consultado en vivo a ms-users (ver app/services/users_client.py). Esta
    es la funcion que expone el router -- get_orders() sigue existiendo
    sin cambios para quien solo necesite los datos crudos."""
    enriched = []
    for order in orders:
        orders_by_status_total.labels(status=order["status"]).inc()
        user_name = await fetch_user_name(order["userId"])
        enriched.append({**order, "userName": user_name})
    return enriched
