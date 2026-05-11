"""CLI for zk-auth."""
from __future__ import annotations
import argparse
import json
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.normpath(os.path.join(_HERE, "..")))

from zkauth.enrollment import EnrollmentService, random_field_element
from zkauth.session import AuthSession
from zkauth.prover import GrothProver
from zkauth.verifier import GrothVerifier
from zkauth.audit import LLMZKAuditor
from zkauth.poseidon import poseidon_hash, BN254_PRIME


def _state_path(d: str) -> str:
    return os.path.join(d, "zkauth_state.json")


def _load_state(d: str):
    p = _state_path(d)
    if os.path.isfile(p):
        with open(p) as f:
            return json.load(f)
    return {"users": {}}


def _save_state(d: str, state) -> None:
    with open(_state_path(d), "w") as f:
        json.dump(state, f, indent=2)


def cmd_enroll(args):
    state = _load_state(args.state_dir)
    secret = int(args.secret, 0) if args.secret.startswith(("0x", "0X")) \
              else int(args.secret)
    secret = secret % BN254_PRIME or 1
    salt = random_field_element()
    commitment = poseidon_hash([secret, salt])
    state["users"][args.user] = {
        "salt": str(salt),
        "commitment": str(commitment),
    }
    _save_state(args.state_dir, state)
    print(json.dumps({
        "user": args.user, "salt": str(salt),
        "commitment": str(commitment),
    }, indent=2))


def cmd_prove(args):
    state = _load_state(args.state_dir)
    user = state["users"].get(args.user)
    if user is None:
        print(json.dumps({"ok": False, "error": "not enrolled"}))
        return 1
    secret = int(args.secret, 0) if args.secret.startswith(("0x", "0X")) \
              else int(args.secret)
    secret = secret % BN254_PRIME or 1
    challenge = int(args.challenge, 0) if args.challenge.startswith(("0x", "0X")) \
                 else int(args.challenge)
    prover = GrothProver(wasm_path=args.wasm, zkey_path=args.zkey)
    bundle = prover.prove(
        secret=secret,
        salt=int(user["salt"]),
        challenge=challenge,
        commitment=int(user["commitment"]),
    )
    print(json.dumps(bundle.to_dict(), indent=2))


def cmd_verify(args):
    """Standalone snarkjs verify (does not enforce challenge binding)."""
    with open(args.bundle) as f:
        b = json.load(f)
    from zkauth.prover import ProofBundle
    bundle = ProofBundle(
        proof=b["proof"], public_signals=b["public_signals"],
        challenge_response=int(b.get("challenge_response", b["public_signals"][0])),
    )
    state = _load_state(args.state_dir)
    enr = EnrollmentService()
    for uid, rec in state["users"].items():
        from zkauth.enrollment import Enrollment
        enr.store.put(Enrollment(
            user_id=uid, commitment=int(rec["commitment"]),
            salt=int(rec["salt"])))
    sess = AuthSession()
    sess.issue(args.user)  # placeholder: caller should re-issue properly
    # Force the session to accept the proof's challenge for CLI demo:
    pub_challenge = int(bundle.public_signals[2])
    from zkauth.session import Challenge
    import time
    sess._challenges[(args.user, pub_challenge)] = Challenge(
        user_id=args.user, nonce=pub_challenge, issued_at=time.time(),
        ttl_seconds=300, consumed=False)
    verifier = GrothVerifier(vkey_path=args.vkey, enrollment=enr, session=sess)
    result = verifier.verify(args.user, bundle)
    print(json.dumps({
        "ok": result.ok, "reason": result.reason,
        "user": result.user_id,
        "challenge_response": result.challenge_response,
    }, indent=2))


def cmd_audit(args):
    from llm_client import LLMClient
    auditor = LLMZKAuditor(LLMClient(), model=args.model)
    deployment = {
        "scheme": "Groth16 over BN254",
        "circuit": "Poseidon(secret,salt)==commitment + Poseidon(secret,challenge)==response",
        "trusted_setup_participants": args.participants,
        "challenge_ttl_seconds": args.ttl,
        "key_rotation_days": args.rotation,
        "deployment": args.deployment,
    }
    out = auditor.audit(deployment)
    print(json.dumps(out.to_dict(), indent=2))


def main(argv=None):
    p = argparse.ArgumentParser(prog="zkauth")
    p.add_argument("--state-dir", default=os.environ.get("ZKAUTH_STATE", "./state"))
    sub = p.add_subparsers(dest="cmd", required=True)

    e = sub.add_parser("enroll")
    e.add_argument("user")
    e.add_argument("secret")
    e.set_defaults(func=cmd_enroll)

    pr = sub.add_parser("prove")
    pr.add_argument("user")
    pr.add_argument("secret")
    pr.add_argument("challenge")
    pr.add_argument("--wasm", default="build/auth_js/auth.wasm")
    pr.add_argument("--zkey", default="build/auth_final.zkey")
    pr.set_defaults(func=cmd_prove)

    vf = sub.add_parser("verify")
    vf.add_argument("user")
    vf.add_argument("bundle")
    vf.add_argument("--vkey", default="build/verification_key.json")
    vf.set_defaults(func=cmd_verify)

    au = sub.add_parser("audit")
    au.add_argument("--participants", type=int, default=1)
    au.add_argument("--ttl", type=int, default=60)
    au.add_argument("--rotation", type=int, default=90)
    au.add_argument("--deployment", default="single-tenant")
    au.add_argument("--model", default="glm-5.1")
    au.set_defaults(func=cmd_audit)

    args = p.parse_args(argv)
    os.makedirs(args.state_dir, exist_ok=True)
    return args.func(args) or 0


if __name__ == "__main__":
    sys.exit(main())
