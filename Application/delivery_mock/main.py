"""delivery-mock: stand-in for the third-party delivery service.

Implements the same shape the real provider will: accept a delivery request,
return a tracking reference, and call back to the backend's HMAC-signed
webhook to drive T2 (status sync).

Default behavior: auto-advance through Accepted → PickedUp → Delivering →
Delivered on a short timer. Admin can also force a state change via
POST /admin/advance/{reference}.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import os
import secrets
from typing import Literal

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

WEBHOOK_SECRET = os.environ["DELIVERY_WEBHOOK_SECRET"].encode()
BACKEND_BASE_URL = os.environ.get("BACKEND_BASE_URL", "http://backend:8000")

app = FastAPI(title="delivery-mock", version="0.0.1")

State = Literal["Accepted", "PickedUp", "Delivering", "Delivered", "Failed"]
TRANSITIONS: list[State] = ["Accepted", "PickedUp", "Delivering", "Delivered"]

_jobs: dict[str, dict[str, str]] = {}


class DeliveryRequest(BaseModel):
    order_code: str
    recipient_name: str
    recipient_phone: str
    address: str
    cod_amount_vnd: int
    pickup_address: str


class DeliveryResponse(BaseModel):
    reference: str


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/deliveries", response_model=DeliveryResponse)
async def create_delivery(req: DeliveryRequest) -> DeliveryResponse:
    reference = f"mock-{secrets.token_urlsafe(8)}"
    _jobs[reference] = {"order_code": req.order_code, "state": "Accepted"}
    asyncio.create_task(_auto_advance(reference))
    return DeliveryResponse(reference=reference)


@app.get("/deliveries/{reference}")
def get_delivery(reference: str) -> dict[str, str]:
    job = _jobs.get(reference)
    if job is None:
        raise HTTPException(status_code=404, detail="not found")
    return job


@app.post("/admin/advance/{reference}")
async def force_advance(reference: str, state: State) -> dict[str, str]:
    job = _jobs.get(reference)
    if job is None:
        raise HTTPException(status_code=404, detail="not found")
    job["state"] = state
    await _send_webhook(reference, state)
    return job


async def _auto_advance(reference: str) -> None:
    for state in TRANSITIONS:
        await asyncio.sleep(2)
        job = _jobs.get(reference)
        if job is None or job["state"] in ("Delivered", "Failed"):
            return
        job["state"] = state
        await _send_webhook(reference, state)


async def _send_webhook(reference: str, state: State) -> None:
    payload = {"reference": reference, "state": state}
    body = json.dumps(payload, separators=(",", ":")).encode()
    signature = hmac.new(WEBHOOK_SECRET, body, hashlib.sha256).hexdigest()
    async with httpx.AsyncClient(timeout=5) as client:
        try:
            await client.post(
                f"{BACKEND_BASE_URL}/api/webhooks/delivery",
                content=body,
                headers={
                    "Content-Type": "application/json",
                    "X-Signature": signature,
                },
            )
        except httpx.HTTPError:
            # Backend may be down briefly; mock does not retry. Real provider would.
            pass
