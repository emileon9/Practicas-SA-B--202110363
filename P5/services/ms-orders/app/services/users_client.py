"""Cliente real hacia ms-users (Practica 10): la primera llamada
sincrona entre microservicios de este proyecto. Se agrega para poder
demostrar una traza distribuida que atraviese 3 servicios reales
(gateway -> ms-orders -> ms-users), usando un dato que ya existe en cada
orden (`userId`) -- no se inventa ningun endpoint nuevo en ms-users mas
alla de `user(id)`, que reutiliza el mismo catalogo en memoria que ya
exponia `users` (ver P5/services/ms-users/src/services/users.service.ts).

Resiliente a proposito: si ms-users no responde, la orden se devuelve
igual (sin nombre de usuario) en vez de que listar pedidos falle por
completo porque otro servicio esta caido -- lo mismo que ya hace el
`AnalysisTemplate` canario (P8) al tratar timeouts como fallo, no al
revés (aqui es "no bloquear al usuario final" ante un fallo del servicio
secundario, no "ignorar el fallo").
"""

import logging
from typing import Optional

import httpx

from app.config import USERS_SERVICE_TIMEOUT_SECONDS, USERS_SERVICE_URL

logger = logging.getLogger("ms-orders")

_QUERY = "query($id: Int!) { user(id: $id) { name } }"


async def fetch_user_name(user_id: int) -> Optional[str]:
    try:
        async with httpx.AsyncClient(timeout=USERS_SERVICE_TIMEOUT_SECONDS) as client:
            response = await client.post(
                f"{USERS_SERVICE_URL}/graphql",
                json={"query": _QUERY, "variables": {"id": user_id}},
            )
            response.raise_for_status()
            data = response.json()
            user = data.get("data", {}).get("user")
            return user["name"] if user else None
    except httpx.HTTPError as exc:
        # No se usa el message de la excepcion completo como campo
        # estructurado de alta cardinalidad; solo se registra que fallo y
        # el tipo de error, suficiente para diagnosticar sin violar la
        # restriccion de cardinalidad del enunciado de P10.
        logger.warning(
            "fallo al consultar ms-users para userId=%s: %s", user_id, type(exc).__name__
        )
        return None
