from fastapi import FastAPI
from app.routers import orders

app = FastAPI(title="ms-orders")

app.include_router(orders.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "ms-orders"}
