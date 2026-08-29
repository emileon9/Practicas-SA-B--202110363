notifications = [
    {"id": 1, "userId": 1, "message": "Tu pedido #1 esta pendiente de confirmacion", "read": False},
    {"id": 2, "userId": 2, "message": "Tu pedido #2 fue enviado", "read": False},
    {"id": 3, "userId": 3, "message": "Tu pedido #3 fue entregado", "read": True},
]


def get_notifications():
    return notifications
