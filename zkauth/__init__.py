"""zk-auth: zero-knowledge password-style authentication.

Architecture:

    enrollment           runtime
    ----------           -------
    user secret          server picks challenge nonce
        |                       |
    salt + Poseidon          send to client
        |                       |
    commitment   --> store   client proves:
    challenge=0  --> store     Poseidon(secret, salt) == commitment
                               Poseidon(secret, challenge) == response
                       |
                  Groth16 proof + public signals
                       |
                  server verifies via snarkjs

The client never reveals `secret`. Replay is bound by the random
`challenge`. The library wraps the circom + snarkjs toolchain through
subprocess, with a pure-Python Poseidon implementation for unit tests
that don't shell out to node.
"""
from .poseidon import poseidon_hash
from .enrollment import EnrollmentService, Enrollment
from .session import AuthSession, Challenge
from .prover import GrothProver, ProofBundle
from .verifier import GrothVerifier, VerificationResult
from .audit import LLMZKAuditor, ZKAudit

__all__ = [
    "poseidon_hash",
    "EnrollmentService", "Enrollment",
    "AuthSession", "Challenge",
    "GrothProver", "ProofBundle",
    "GrothVerifier", "VerificationResult",
    "LLMZKAuditor", "ZKAudit",
]
