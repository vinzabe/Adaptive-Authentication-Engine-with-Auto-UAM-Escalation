"""Groth16 verifier wrapper.

Performs three checks:
    1. The Groth16 proof verifies under the published verification key.
    2. The public signals embed the *expected* commitment, salt and
       challenge for this user/session (so a valid proof for user A on
       challenge X cannot be presented for user B / challenge Y).
    3. The challenge has not been replayed (delegated to AuthSession).
"""
from __future__ import annotations
import json
import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .enrollment import EnrollmentService
from .session import AuthSession
from .prover import ProofBundle


@dataclass
class VerificationResult:
    ok: bool
    user_id: str
    reason: str = "ok"
    challenge_response: Optional[int] = None
    public_signals: List[str] = field(default_factory=list)


class GrothVerifier:
    """Verifies bundles produced by GrothProver.

    The circuit's *public* signals are emitted in the order:
        [challenge_response, salt, challenge, commitment]
    (snarkjs convention: outputs first, then inputs in declaration order).
    """

    PUB_RESPONSE_IDX = 0
    PUB_SALT_IDX = 1
    PUB_CHALLENGE_IDX = 2
    PUB_COMMITMENT_IDX = 3

    def __init__(self, *,
                  vkey_path: str,
                  enrollment: EnrollmentService,
                  session: AuthSession,
                  snarkjs_bin: Optional[str] = None):
        if not os.path.isfile(vkey_path):
            raise FileNotFoundError(f"vkey not found: {vkey_path}")
        self.vkey_path = vkey_path
        self.enrollment = enrollment
        self.session = session
        self.snarkjs = snarkjs_bin or shutil.which("snarkjs") or "snarkjs"

    # ------------------------------------------------------------------
    def verify(self, user_id: str, bundle: ProofBundle) -> VerificationResult:
        if not user_id:
            return VerificationResult(False, user_id, reason="missing user_id")
        if len(bundle.public_signals) < 4:
            return VerificationResult(False, user_id,
                                       reason="public_signals shape unexpected")
        sig = bundle.public_signals
        try:
            challenge_response = int(sig[self.PUB_RESPONSE_IDX])
            pub_salt = int(sig[self.PUB_SALT_IDX])
            pub_challenge = int(sig[self.PUB_CHALLENGE_IDX])
            pub_commitment = int(sig[self.PUB_COMMITMENT_IDX])
        except (TypeError, ValueError):
            return VerificationResult(False, user_id,
                                       reason="public_signals malformed")

        # 1) bind to enrolled commitment + salt
        enr = self.enrollment.lookup(user_id)
        if enr is None:
            return VerificationResult(False, user_id, reason="user not enrolled")
        if pub_commitment != enr.commitment:
            return VerificationResult(False, user_id,
                                       reason="commitment mismatch")
        if pub_salt != enr.salt:
            return VerificationResult(False, user_id, reason="salt mismatch")

        # 2) bind to outstanding challenge (also enforces single-use + ttl)
        try:
            self.session.consume(user_id, pub_challenge)
        except (LookupError, ValueError) as e:
            return VerificationResult(False, user_id,
                                       reason=f"challenge rejected: {e}")

        # 3) verify the SNARK itself via snarkjs
        ok = self._snarkjs_verify(bundle)
        if not ok:
            return VerificationResult(False, user_id,
                                       reason="snark verification failed",
                                       public_signals=sig)
        return VerificationResult(
            ok=True, user_id=user_id,
            challenge_response=challenge_response,
            public_signals=sig,
        )

    # ------------------------------------------------------------------
    def _snarkjs_verify(self, bundle: ProofBundle) -> bool:
        with tempfile.TemporaryDirectory(prefix="zkauth-vrf-") as td:
            proof_path = os.path.join(td, "proof.json")
            pub_path = os.path.join(td, "public.json")
            with open(proof_path, "w") as f:
                json.dump(bundle.proof, f)
            with open(pub_path, "w") as f:
                json.dump(bundle.public_signals, f)
            proc = subprocess.run(
                [self.snarkjs, "groth16", "verify",
                 self.vkey_path, pub_path, proof_path],
                capture_output=True, text=True, timeout=60,
            )
            # snarkjs prints "OK!" on success and exits 0; "INVALID" on failure
            if proc.returncode != 0:
                return False
            blob = (proc.stdout + proc.stderr).upper()
            return "OK!" in blob
