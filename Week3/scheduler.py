"""Background scheduler for periodic tasks.

Runs inside the same FastAPI process using APScheduler.
Currently registered jobs:
  - expire_combos: every 60 s – mark combos whose validity_end < now as expired.
"""

from __future__ import annotations

import logging
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import select

from app.infra.db.deps import get_db
from app.infra.db.models import Combo

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


# ─── Job implementations ───────────────────────────────────────────────────────

def expire_combos() -> None:
    """Scan combos and flip is_active→False when validity_end has passed."""
    now = datetime.utcnow()
    db_gen = get_db()
    db = next(db_gen)
    try:
        expired = db.scalars(
            select(Combo).where(
                Combo.is_active == True,          # noqa: E712
                Combo.validity_end != None,        # noqa: E711
                Combo.validity_end < now,
            )
        ).all()
        if expired:
            for combo in expired:
                combo.is_active = False
                logger.info("scheduler: combo %d '%s' expired at %s", combo.combo_id, combo.name, now)
            db.commit()
    except Exception as exc:
        db.rollback()
        logger.exception("scheduler: expire_combos failed: %s", exc)
    finally:
        try:
            next(db_gen)
        except StopIteration:
            pass


# ─── Lifecycle ─────────────────────────────────────────────────────────────────

def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(expire_combos, trigger="interval", seconds=60, id="expire_combos",
                       max_instances=1, coalesce=True)
    _scheduler.start()
    logger.info("scheduler: started (expire_combos every 60 s)")


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("scheduler: stopped")
