"""Tests for zk-auth.

Many tests use real circom artifacts and snarkjs subprocesses. The build/
directory must be populated by `bash scripts/setup.sh` before running.
"""
import json
import os
import sys
import time
import types

import pytest

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.normpath(os.path.join(_HERE, "..")))

from zkauth.poseidon import poseidon_hash, BN254_PRIME
from zkauth.enrollment import (
    EnrollmentService, Enrollment, InMemoryStore, random_field_element,
)
from zkauth.session import AuthSession, Challenge
from zkauth.prover import GrothProver, ProofBundle
from zkauth.verifier import GrothVerifier, VerificationResult
from zkauth.audit import LLMZKAuditor, ZKAudit


BUILD_DIR = os.path.normpath(os.path.join(_HERE, "..", "build"))
WASM = os.path.join(BUILD_DIR, "auth_js", "auth.wasm")
ZKEY = os.path.join(BUILD_DIR, "auth_final.zkey")
VKEY = os.path.join(BUILD_DIR, "verification_key.json")

CIRCUIT_BUILT = (os.path.isfile(WASM) and os.path.isfile(ZKEY)
                  and os.path.isfile(VKEY))
needs_circuit = pytest.mark.skipif(
    not CIRCUIT_BUILT,
    reason="run scripts/setup.sh to build circom artifacts")


# ---------------------------------------------------------------------------
# Poseidon

class TestPoseidon:

    def test_known_vector(self):
        # Matches circomlibjs poseidon([3,5])
        h = poseidon_hash([3, 5])
        assert h == 6785167652243325121502926540806452447443769108715415059349984576933636058888

    def test_in_field(self):
        h = poseidon_hash([random_field_element(), random_field_element()])
        assert 0 < h < BN254_PRIME

    def test_string_inputs_accepted(self):
        a = poseidon_hash([3, 5])
        b = poseidon_hash(["3", "5"])
        c = poseidon_hash(["0x3", "0x5"])
        assert a == b == c

    def test_rejects_empty(self):
        with pytest.raises(ValueError):
            poseidon_hash([])

    def test_rejects_bad_type(self):
        with pytest.raises(TypeError):
            poseidon_hash([3, object()])

    def test_negative_normalised(self):
        # -1 mod p == p-1; Poseidon(-1, 0) must equal Poseidon(p-1, 0)
        a = poseidon_hash([-1, 0])
        b = poseidon_hash([BN254_PRIME - 1, 0])
        assert a == b


# ---------------------------------------------------------------------------
# Enrollment

class TestEnrollment:

    def test_enroll_creates_record(self):
        svc = EnrollmentService()
        enr = svc.enroll("alice", 12345)
        assert enr.user_id == "alice"
        assert 0 < enr.salt < BN254_PRIME
        assert 0 < enr.commitment < BN254_PRIME
        # Commitment must be reproducible
        assert poseidon_hash([12345, enr.salt]) == enr.commitment

    def test_lookup_and_revoke(self):
        svc = EnrollmentService()
        svc.enroll("bob", 7)
        assert svc.lookup("bob") is not None
        assert svc.revoke("bob") is True
        assert svc.lookup("bob") is None
        assert svc.revoke("bob") is False

    def test_duplicate_enroll_rejected(self):
        svc = EnrollmentService()
        svc.enroll("alice", 1)
        with pytest.raises(ValueError):
            svc.enroll("alice", 2)

    def test_invalid_secret(self):
        svc = EnrollmentService()
        with pytest.raises(TypeError):
            svc.enroll("alice", "not-int")
        with pytest.raises(ValueError):
            svc.enroll("alice", 0)
        with pytest.raises(ValueError):
            svc.enroll("alice", BN254_PRIME)

    def test_invalid_user_id(self):
        svc = EnrollmentService()
        with pytest.raises(ValueError):
            svc.enroll("", 1)

    def test_random_field_element_distinct(self):
        rs = {random_field_element() for _ in range(10)}
        assert len(rs) == 10
        assert all(0 < r < BN254_PRIME for r in rs)


# ---------------------------------------------------------------------------
# Session

class TestSession:

    def test_issue_then_consume(self):
        s = AuthSession(default_ttl_seconds=10)
        ch = s.issue("alice")
        assert ch.user_id == "alice"
        assert not ch.consumed
        consumed = s.consume("alice", ch.nonce)
        assert consumed.consumed is True

    def test_replay_rejected(self):
        s = AuthSession()
        ch = s.issue("alice")
        s.consume("alice", ch.nonce)
        with pytest.raises(ValueError):
            s.consume("alice", ch.nonce)

    def test_unknown_challenge(self):
        s = AuthSession()
        with pytest.raises(LookupError):
            s.consume("alice", 12345)

    def test_expiry(self):
        s = AuthSession(default_ttl_seconds=0.01)
        ch = s.issue("alice")
        time.sleep(0.05)
        with pytest.raises(ValueError):
            s.consume("alice", ch.nonce)

    def test_open_count_and_gc(self):
        s = AuthSession(default_ttl_seconds=10)
        c1 = s.issue("a")
        c2 = s.issue("b")
        c3 = s.issue("c")
        s.consume("a", c1.nonce)
        assert s.open_count() == 2
        # gc removes the consumed one
        removed = s.gc()
        assert removed >= 1
        assert s.open_count() == 2


# ---------------------------------------------------------------------------
# Prover/Verifier (need real circuit)

@needs_circuit
class TestProverVerifier:

    def _setup(self):
        enr = EnrollmentService()
        sess = AuthSession(default_ttl_seconds=60)
        secret = 0xCAFEBABE_DEADBEEF
        e = enr.enroll("alice", secret)
        ch = sess.issue("alice")
        prover = GrothProver(wasm_path=WASM, zkey_path=ZKEY)
        verifier = GrothVerifier(vkey_path=VKEY, enrollment=enr, session=sess)
        return enr, sess, secret, e, ch, prover, verifier

    def test_happy_path(self):
        enr, sess, secret, e, ch, prover, verifier = self._setup()
        bundle = prover.prove(secret=secret, salt=e.salt,
                               challenge=ch.nonce, commitment=e.commitment)
        result = verifier.verify("alice", bundle)
        assert result.ok, result.reason
        assert result.challenge_response == bundle.challenge_response
        # Expected response matches Poseidon(secret, challenge)
        assert (result.challenge_response
                == GrothProver.expected_challenge_response(secret, ch.nonce))

    def test_replay_blocked_at_session_layer(self):
        enr, sess, secret, e, ch, prover, verifier = self._setup()
        bundle = prover.prove(secret=secret, salt=e.salt,
                               challenge=ch.nonce, commitment=e.commitment)
        r1 = verifier.verify("alice", bundle)
        assert r1.ok
        r2 = verifier.verify("alice", bundle)
        assert not r2.ok
        assert "challenge" in r2.reason.lower()

    def test_wrong_user(self):
        enr, sess, secret, e, ch, prover, verifier = self._setup()
        bundle = prover.prove(secret=secret, salt=e.salt,
                               challenge=ch.nonce, commitment=e.commitment)
        r = verifier.verify("eve", bundle)
        assert not r.ok
        assert "not enrolled" in r.reason

    def test_wrong_secret_rejected_by_circuit(self):
        enr, sess, secret, e, ch, prover, verifier = self._setup()
        # Try to prove with a wrong secret -- circom should fail at witness gen
        with pytest.raises(RuntimeError) as ex:
            prover.prove(secret=secret + 1, salt=e.salt,
                          challenge=ch.nonce, commitment=e.commitment)
        msg = str(ex.value).lower()
        assert "witness" in msg or "constraint" in msg or "assert" in msg

    def test_swapped_challenge_rejected(self):
        enr, sess, secret, e, ch, prover, verifier = self._setup()
        # Prove with one challenge, then pretend it was for a different one
        bundle = prover.prove(secret=secret, salt=e.salt,
                               challenge=ch.nonce, commitment=e.commitment)
        # Issue a fresh challenge and try to consume that instead
        ch2 = sess.issue("alice")
        # Hand-edit the bundle's public_signals to swap challenge
        from copy import deepcopy
        bad = deepcopy(bundle)
        bad.public_signals[verifier.PUB_CHALLENGE_IDX] = str(ch2.nonce)
        r = verifier.verify("alice", bad)
        assert not r.ok
        # Either snark fails or session consumed but snark verifies false
        assert "snark" in r.reason.lower() or "challenge" in r.reason.lower()

    def test_missing_signals(self):
        enr, sess, secret, e, ch, prover, verifier = self._setup()
        bundle = ProofBundle(proof={}, public_signals=["1", "2"],
                              challenge_response=1)
        r = verifier.verify("alice", bundle)
        assert not r.ok
        assert "shape" in r.reason or "malformed" in r.reason

    def test_missing_user_id(self):
        enr, sess, secret, e, ch, prover, verifier = self._setup()
        bundle = prover.prove(secret=secret, salt=e.salt,
                               challenge=ch.nonce, commitment=e.commitment)
        r = verifier.verify("", bundle)
        assert not r.ok


# ---------------------------------------------------------------------------
# LLM auditor (mocked)

class FakeLLM:
    def __init__(self, content): self.content = content
    def chat(self, messages, **kw):
        return types.SimpleNamespace(content=self.content)


class TestLLMAuditor:

    def test_parses_full_response(self):
        body = json.dumps({
            "posture": "moderate", "confidence": 0.7,
            "findings": [{
                "name": "single-contributor ceremony",
                "severity": "high",
                "description": "Trusted setup had only 1 contributor.",
                "mitigation": "Run a multi-party MPC ceremony.",
            }],
            "replay_protection": "strong",
            "side_channels": ["proof generation timing leaks user activity"],
            "recommendations": ["rotate keys", "ttl<=30s"],
        })
        out = LLMZKAuditor(FakeLLM(body)).audit({"scheme": "Groth16"})
        assert isinstance(out, ZKAudit)
        assert out.posture == "moderate"
        assert out.findings[0]["severity"] == "high"
        assert out.replay_protection == "strong"

    def test_parses_fenced(self):
        body = "```json\n" + json.dumps({"posture": "strong", "confidence": 0.9}) + "\n```"
        out = LLMZKAuditor(FakeLLM(body)).audit({})
        assert out.posture == "strong"
        assert out.confidence == 0.9

    def test_invalid_json(self):
        out = LLMZKAuditor(FakeLLM("nope")).audit({})
        assert out.posture == "weak"
        assert out.confidence == 0.0

    def test_normalises_arrays(self):
        body = json.dumps({"posture": "moderate", "confidence": 0.5,
                            "side_channels": "single"})
        out = LLMZKAuditor(FakeLLM(body)).audit({})
        assert out.side_channels == ["single"]

    def test_clamps_replay_field(self):
        body = json.dumps({"posture": "moderate", "confidence": 0.5,
                            "replay_protection": "exotic"})
        out = LLMZKAuditor(FakeLLM(body)).audit({})
        assert out.replay_protection == "unknown"


# ---------------------------------------------------------------------------
# Live LLM smoke

@pytest.mark.skipif(not os.environ.get("LLM_LIVE"),
                     reason="LLM_LIVE not set")
def test_live_llm_audit():
    from llm_client import LLMClient
    auditor = LLMZKAuditor(LLMClient(timeout=180), model="glm-5.1")
    out = auditor.audit({
        "scheme": "Groth16 over BN254",
        "circuit": "Poseidon(secret,salt)==commitment + challenge binding",
        "trusted_setup_participants": 1,
        "challenge_ttl_seconds": 60,
        "key_rotation_days": 90,
        "deployment": "single-tenant cloud",
    })
    assert out.posture in ("strong", "moderate", "weak")
    assert isinstance(out.findings, list)
    print(f"\n[live] posture={out.posture} conf={out.confidence:.2f} "
            f"findings={len(out.findings)} replay={out.replay_protection}")
