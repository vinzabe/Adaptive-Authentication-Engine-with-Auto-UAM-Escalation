"""Poseidon BN254 hash via circomlibjs (Node helper).

We could implement Poseidon in pure Python, but matching the *exact* round
constants and MDS matrix used by `circomlib`'s Poseidon template requires
careful constant-table porting. Shelling out to circomlibjs guarantees a
1:1 match with the on-chain constraint system, at the cost of a Node
subprocess per hash. For an auth flow this is fine -- enrollment + auth
are infrequent, low-throughput operations.
"""
from __future__ import annotations
import json
import os
import shutil
import subprocess
from typing import List, Sequence, Union

BN254_PRIME = 21888242871839275222246405745257275088696311157297823662689037894645226208583

_HERE = os.path.dirname(os.path.abspath(__file__))
_HELPER = os.path.join(_HERE, "_node_helpers", "poseidon.cjs")


def _node_path() -> str:
    n = shutil.which("node")
    if not n:
        raise RuntimeError("node not found on PATH")
    return n


def _node_modules_dir() -> str:
    """Return a NODE_PATH that has circomlibjs reachable.

    Tries: $NODE_PATH if already set, then `npm root -g` output.
    """
    np = os.environ.get("NODE_PATH")
    if np:
        for d in np.split(os.pathsep):
            if os.path.isdir(os.path.join(d, "circomlibjs")):
                return np
    # Probe global root
    try:
        out = subprocess.run(["npm", "root", "-g"], capture_output=True,
                              text=True, timeout=10)
        gr = out.stdout.strip()
        if gr and os.path.isdir(os.path.join(gr, "circomlibjs")):
            return gr
    except Exception:
        pass
    # Last resort: hope node finds it
    return ""


# Module-level cache for the resolved NODE_PATH
_NODE_PATH_CACHE: str = ""


def _resolved_node_path() -> str:
    global _NODE_PATH_CACHE
    if not _NODE_PATH_CACHE:
        _NODE_PATH_CACHE = _node_modules_dir()
    return _NODE_PATH_CACHE


def poseidon_hash(inputs: Sequence[Union[int, str]]) -> int:
    """Return Poseidon(inputs) as an int in the BN254 scalar field."""
    if not inputs:
        raise ValueError("inputs must be non-empty")
    # Normalize: every value -> reduced int -> decimal string
    normed: List[str] = []
    for v in inputs:
        if isinstance(v, int):
            iv = v % BN254_PRIME
        elif isinstance(v, str):
            iv = int(v, 0) % BN254_PRIME if v.startswith(("0x", "0X")) \
                  else int(v) % BN254_PRIME
        else:
            raise TypeError(f"unsupported input: {type(v).__name__}")
        if iv < 0:
            iv += BN254_PRIME
        normed.append(str(iv))
    payload = json.dumps(normed)
    env = os.environ.copy()
    np = _resolved_node_path()
    if np:
        env["NODE_PATH"] = np
    proc = subprocess.run(
        [_node_path(), _HELPER, payload],
        capture_output=True, text=True, timeout=30, env=env,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"poseidon helper failed (rc={proc.returncode}): "
            f"{proc.stderr.strip()[:400]}")
    out = proc.stdout.strip()
    if not out:
        raise RuntimeError("empty output from poseidon helper")
    return int(out)
