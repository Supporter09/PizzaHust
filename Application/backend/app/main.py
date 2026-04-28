from fastapi import FastAPI

app = FastAPI(title="PizzaHUST API", version="0.0.1", docs_url="/api/docs", openapi_url="/api/openapi.json")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
