from fastapi import FastAPI
from app.routers import orders
from app.observability.tracing import setup_tracing
from app.observability.metrics import setup_metrics
from app.observability.logging_config import setup_logging

app = FastAPI(title="ms-orders")

setup_logging("ms-orders")
setup_tracing(app)  # debe ir antes de incluir routers: instrumenta el manejo de requests de FastAPI
setup_metrics(app)

app.include_router(orders.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "ms-orders"}
