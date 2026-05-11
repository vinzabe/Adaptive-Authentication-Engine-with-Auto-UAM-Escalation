"""Groth16 prover wrapper.

Drives:
    1. snarkjs `wtns calculate`  -> witness.wtns
    2. snarkjs `groth16 prove`   -> proof.json + public.json

Returns a structured `ProofBundle` that the verifier can consume.
"""
from __future__ import annotations
import json
import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .poseidon import poseidon_hash


@dataclass
class ProofBundle:
    proof: Dict[str, Any]              # snarkjs proof.json structure
    public_signals: List[str]          # decimal strings, in circuit order
    challenge_response: int            # parsed convenience field

    def to_dict(self) -> Dict[str, Any]:
        return {
            "proof": self.proof,
            "public_signals": self.public_signals,
            "challenge_response": str(self.challenge_response),
        }


class GrothProver:
    def __init__(self, *,
                  wasm_path: str,
                  zkey_path: str,
                  snarkjs_bin: Optional[str] = None,
                  node_bin: Optional[str] = None,
                  witness_calculator_js: Optional[str] = None):
        if not os.path.isfile(wasm_path):
            raise FileNotFoundError(f"wasm not found: {wasm_path}")
        if not os.path.isfile(zkey_path):
            raise FileNotFoundError(f"zkey not found: {zkey_path}")
        self.wasm_path = wasm_path
        self.zkey_path = zkey_path
        self.snarkjs = snarkjs_bin or shutil.which("snarkjs") or "snarkjs"
        self.node = node_bin or shutil.which("node") or "node"
        # Witness calculator JS: snarkjs's `wtns calculate` works via the wasm
        # directly; if a generate_witness.js companion file is present (older
        # circom output convention), we can use it too.
        self.witness_js = witness_calculator_js

    # ------------------------------------------------------------------
    def prove(self, *,
                secret: int, salt: int, challenge: int, commitment: int,
                workdir: Optional[str] = None) -> ProofBundle:
        # Order must match the circuit's declared signals
        circuit_inputs = {
            "secret": str(secret),
            "salt": str(salt),
            "challenge": str(challenge),
            "commitment": str(commitment),
        }
        cleanup = False
        if workdir is None:
            workdir = tempfile.mkdtemp(prefix="zkauth-")
            cleanup = True
        try:
            input_path = os.path.join(workdir, "input.json")
            wtns_path = os.path.join(workdir, "witness.wtns")
            proof_path = os.path.join(workdir, "proof.json")
            public_path = os.path.join(workdir, "public.json")
            with open(input_path, "w") as f:
                json.dump(circuit_inputs, f)
            # 1) witness
            if self.witness_js and os.path.isfile(self.witness_js):
                cmd = [self.node, self.witness_js, self.wasm_path,
                       input_path, wtns_path]
            else:
                cmd = [self.snarkjs, "wtns", "calculate",
                       self.wasm_path, input_path, wtns_path]
            self._run(cmd, "witness calculation")
            # 2) prove
            self._run(
                [self.snarkjs, "groth16", "prove",
                 self.zkey_path, wtns_path, proof_path, public_path],
                "proof generation",
            )
            with open(proof_path) as f:
                proof = json.load(f)
            with open(public_path) as f:
                pubsig = json.load(f)
            if not pubsig:
                raise RuntimeError("no public signals returned")
            challenge_response = int(pubsig[0])
            return ProofBundle(
                proof=proof,
                public_signals=[str(s) for s in pubsig],
                challenge_response=challenge_response,
            )
        finally:
            if cleanup:
                shutil.rmtree(workdir, ignore_errors=True)

    # ------------------------------------------------------------------
    @staticmethod
    def _run(cmd, label):
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if proc.returncode != 0:
            raise RuntimeError(
                f"{label} failed (rc={proc.returncode}): "
                f"{proc.stderr[-400:].strip() or proc.stdout[-400:].strip()}")

    # ------------------------------------------------------------------
    @staticmethod
    def expected_challenge_response(secret: int, challenge: int) -> int:
        return poseidon_hash([secret, challenge])
