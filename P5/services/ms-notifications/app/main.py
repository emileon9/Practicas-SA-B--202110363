from fastapi import FastAPI
from app.routers import notifications
from app.services import summary_consumer

app = FastAPI(title="ms-notifications")

app.include_router(notifications.router)


@app.on_event("startup")
def on_startup():
    summary_consumer.start()


@app.on_event("shutdown")
def on_shutdown():
    summary_consumer.stop()


@app.get("/health")
def health():
    return {"status": "ok", "service": "ms-notifications"}
