"""Funcionamento da loja: aberto/fechado, previsão e horários de agendamento."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import BusinessHours, Holiday, StoreSettings

SLOT_MINUTES = 30


def get_store(db: Session) -> StoreSettings:
    store = db.get(StoreSettings, 1)
    if store is None:
        store = StoreSettings(id=1)
        db.add(store)
        db.commit()
    return store


@dataclass
class Window:
    start: datetime
    end: datetime


def _windows_for_day(db: Session, day: datetime, tz: ZoneInfo) -> list[Window]:
    """Janelas de funcionamento que começam no dia local `day`."""
    if db.scalar(select(Holiday).where(Holiday.day == day.date())):
        return []
    rows = db.scalars(select(BusinessHours).where(BusinessHours.weekday == day.weekday())).all()
    out = []
    for r in rows:
        start = datetime.combine(day.date(), r.opens_at, tz)
        end = datetime.combine(day.date(), r.closes_at, tz)
        if end <= start:  # atravessa a meia-noite
            end += timedelta(days=1)
        out.append(Window(start, end))
    return sorted(out, key=lambda w: w.start)


def windows_around(db: Session, now: datetime, days_ahead: int) -> list[Window]:
    tz = now.tzinfo  # type: ignore[assignment]
    out: list[Window] = []
    for offset in range(-1, days_ahead + 1):
        out.extend(_windows_for_day(db, now + timedelta(days=offset), tz))  # type: ignore[arg-type]
    return sorted(out, key=lambda w: w.start)


def local_now(store: StoreSettings, now: datetime | None = None) -> datetime:
    tz = ZoneInfo(store.timezone)
    return (now or datetime.now(tz)).astimezone(tz)


def is_open(db: Session, store: StoreSettings, now: datetime | None = None) -> bool:
    if store.is_paused:
        return False
    n = local_now(store, now)
    return any(w.start <= n < w.end for w in windows_around(db, n, 0))


def next_opening(db: Session, store: StoreSettings, now: datetime | None = None) -> datetime | None:
    n = local_now(store, now)
    for w in windows_around(db, n, 7):
        if w.start > n:
            return w.start
    return None


def schedule_slots(db: Session, store: StoreSettings, now: datetime | None = None) -> list[datetime]:
    """Horários agendáveis: dentro do funcionamento e após o tempo de preparo."""
    if not store.accept_scheduled:
        return []
    n = local_now(store, now)
    earliest = n + timedelta(minutes=store.prep_time_minutes + 15)
    slots: list[datetime] = []
    for w in windows_around(db, n, store.schedule_days_ahead):
        t = w.start + timedelta(minutes=store.prep_time_minutes)
        while t + timedelta(minutes=SLOT_MINUTES) <= w.end:
            if t >= earliest:
                slots.append(t)
            t += timedelta(minutes=SLOT_MINUTES)
    return slots[:96]


def is_valid_slot(db: Session, store: StoreSettings, when: datetime, now: datetime | None = None) -> bool:
    target = when.astimezone(ZoneInfo(store.timezone))
    return any(abs((s - target).total_seconds()) < 60 for s in schedule_slots(db, store, now))
