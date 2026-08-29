from fastapi import APIRouter
from app.services.notifications_service import get_notifications

router = APIRouter()


@router.get("/notifications")
def list_notifications():
    return get_notifications()
