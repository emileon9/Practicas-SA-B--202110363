from fastapi import APIRouter
from app.services.orders_service import get_orders_enriched

router = APIRouter()


@router.get("/orders")
async def list_orders():
    # Practica 10: cada orden ahora incluye userName, obtenido de una
    # llamada real a ms-users (ver app/services/users_client.py). Esto es
    # lo que crea la traza de 3 servicios: cliente -> gateway -> ms-orders
    # -> ms-users.
    return await get_orders_enriched()
