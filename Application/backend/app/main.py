from fastapi import FastAPI

from app.api.auth import router as auth_router
from app.api.menu import router as menu_router

app = FastAPI(
    title="PizzaHUST API",
    version="0.0.1",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.include_router(auth_router)
app.include_router(menu_router)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
