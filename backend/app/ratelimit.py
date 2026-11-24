"""Rate limiting simples em memória (janela deslizante por IP e rota).

Para várias instâncias atrás de um balanceador, troque por Redis ou pelo
limitador do proxy (Nginx, Cloudflare).
"""
from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

_hits: dict[str, deque[float]] = defaultdict(deque)


def limit(max_calls: int, per_seconds: int):
    def dep(request: Request) -> None:
        ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (
            request.client.host if request.client else "?"
        )
        key = f"{request.url.path.split('/')[2] if request.url.path.count('/') > 1 else ''}:{ip}:{max_calls}"
        now = time.monotonic()
        q = _hits[key]
        while q and now - q[0] > per_seconds:
            q.popleft()
        if len(q) >= max_calls:
            raise HTTPException(429, "Muitas tentativas. Aguarde um instante.")
        q.append(now)

    return dep


def reset() -> None:
    _hits.clear()
