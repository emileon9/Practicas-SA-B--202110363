from fastapi import APIRouter
from app.services.orders_service import get_orders

router = APIRouter()


@router.get("/orders")
def list_orders():
    return get_orders()
