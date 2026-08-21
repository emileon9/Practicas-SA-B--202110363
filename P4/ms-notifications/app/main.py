from fastapi import FastAPI
from app.routers import notifications

app = FastAPI(title="ms-notifications")

app.include_router(notifications.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "ms-notifications"}
