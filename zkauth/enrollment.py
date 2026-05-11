"""User enrollment service.

At enrollment time:
    1. Client picks a strong random secret `s` (stays on device).
    2. Server picks a per-user random salt.
    3. Client computes `commitment = Poseidon(s, salt)` and uploads
       (user_id, commitment, salt). The server stores them.

Storage interface is left abstract so tests can swap an in-memory dict for
a real backend.
"""
from __future__ import annotations
import secrets
from dataclasses import dataclass
from typing import Dict, Optional, Protocol

from .poseidon import poseidon_hash, BN254_PRIME


@dataclass
class Enrollment:
    user_id: str
    commitment: int
    salt: int


class EnrollmentStore(Protocol):
    def put(self, enr: Enrollment) -> None: ...
    def get(self, user_id: str) -> Optional[Enrollment]: ...
    def delete(self, user_id: str) -> bool: ...


class InMemoryStore:
    def __init__(self):
        self._db: Dict[str, Enrollment] = {}

    def put(self, enr: Enrollment) -> None:
        self._db[enr.user_id] = enr

    def get(self, user_id: str) -> Optional[Enrollment]:
        return self._db.get(user_id)

    def delete(self, user_id: str) -> bool:
        return self._db.pop(user_id, None) is not None

    def __contains__(self, user_id: str) -> bool:
        return user_id in self._db

    def __len__(self) -> int:
        return len(self._db)


def random_field_element() -> int:
    """Cryptographically random integer in [1, p-1]."""
    while True:
        v = secrets.randbits(254)
        if 0 < v < BN254_PRIME:
            return v


class EnrollmentService:
    def __init__(self, store: Optional[EnrollmentStore] = None):
        self.store = store or InMemoryStore()

    # ------------------------------------------------------------------
    def enroll(self, user_id: str, secret: int) -> Enrollment:
        if not isinstance(user_id, str) or not user_id:
            raise ValueError("user_id must be a non-empty string")
        if not isinstance(secret, int):
            raise TypeError("secret must be int (field element)")
        if secret <= 0 or secret >= BN254_PRIME:
            raise ValueError("secret must lie in [1, p-1]")
        if self.store.get(user_id) is not None:
            raise ValueError(f"user {user_id!r} is already enrolled")
        salt = random_field_element()
        commitment = poseidon_hash([secret, salt])
        enr = Enrollment(user_id=user_id, commitment=commitment, salt=salt)
        self.store.put(enr)
        return enr

    # ------------------------------------------------------------------
    def lookup(self, user_id: str) -> Optional[Enrollment]:
        return self.store.get(user_id)

    def revoke(self, user_id: str) -> bool:
        return self.store.delete(user_id)
