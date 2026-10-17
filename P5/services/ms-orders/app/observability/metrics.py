"""Metricas de ms-orders (Practica 10): tecnicas (via
prometheus-fastapi-instrumentator, que ya cubre latencia/trafico/errores
por ruta sin tener que reimplementarlo a mano) + una metrica de negocio
real, derivada de datos que ya existen en orders_service.py (nunca
inventada).
"""

from prometheus_client import Counter
from prometheus_fastapi_instrumentator import Instrumentator

# Metrica de NEGOCIO: cuantos pedidos existen por estado
# (pending/shipped/delivered). Comprensible para alguien no tecnico
# ("cuantos pedidos estan pendientes de envio ahora mismo").
orders_by_status_total = Counter(
    "sa_orders_viewed_total",
    "Pedidos devueltos a los clientes, por estado",
    labelnames=["status"],
)


def setup_metrics(app) -> None:
    """Expone /metrics con metricas tecnicas estandar de FastAPI
    (latencia/trafico/errores por ruta, saturacion del proceso) sin
    reimplementar ese middleware a mano -- el equivalente Python de
    prom-client + metricsMiddleware que ya se escribio para gateway/ms-users
    en Node."""
    Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)
