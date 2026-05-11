"""Challenge issuance + replay-protection bookkeeping.

A `Challenge` is a fresh random field element issued by the server, with a
TTL and single-use semantics. The verifier rejects proofs whose `challenge`
public input does not match an outstanding (unused, unexpired) challenge
for that user.
"""
from __future__ import annotations
import time
from dataclasses import dataclass
from typing import Dict, Optional, Tuple

from .enrollment import random_field_element


@dataclass
class Challenge:
    user_id: str
    nonce: int        # field element
    issued_at: float
    ttl_seconds: float
    consumed: bool = False

    def is_expired(self, *, now: Optional[float] = None) -> bool:
        now = now if now is not None else time.time()
        return (now - self.issued_at) > self.ttl_seconds


class AuthSession:
    """In-memory challenge tracker."""

    def __init__(self, *, default_ttl_seconds: float = 60.0):
        self.default_ttl = default_ttl_seconds
        self._challenges: Dict[Tuple[str, int], Challenge] = {}

    # ------------------------------------------------------------------
    def issue(self, user_id: str, *,
                ttl_seconds: Optional[float] = None) -> Challenge:
        if not user_id:
            raise ValueError("user_id required")
        nonce = random_field_element()
        ch = Challenge(
            user_id=user_id, nonce=nonce, issued_at=time.time(),
            ttl_seconds=ttl_seconds if ttl_seconds is not None else self.default_ttl,
        )
        self._challenges[(user_id, nonce)] = ch
        return ch

    def consume(self, user_id: str, nonce: int) -> Challenge:
        """Look up and atomically mark as consumed. Raises on miss/expiry/replay."""
        key = (user_id, nonce)
        ch = self._challenges.get(key)
        if ch is None:
            raise LookupError("unknown challenge for this user")
        if ch.consumed:
            raise ValueError("challenge already consumed (replay)")
        if ch.is_expired():
            raise ValueError("challenge expired")
        ch.consumed = True
        return ch

    # ------------------------------------------------------------------
    def open_count(self) -> int:
        now = time.time()
        return sum(1 for c in self._challenges.values()
                   if not c.consumed and not c.is_expired(now=now))

    def gc(self) -> int:
        """Drop expired+consumed entries; return removed count."""
        now = time.time()
        keys = [k for k, c in self._challenges.items()
                 if c.consumed or c.is_expired(now=now)]
        for k in keys:
            del self._challenges[k]
        return len(keys)
