# zk-auth: zero-knowledge password authentication

A working Groth16-based authentication library that lets a user prove to a server they know a secret pre-image of a Poseidon commitment, without ever revealing the secret. Replay protection is folded into the SNARK itself via a server-issued challenge nonce.

The whole pipeline is real:
- `circom` 2.x circuit using `circomlib`'s Poseidon
- BN254 trusted setup with `snarkjs` (Groth16, powers-of-tau)
- `snarkjs` proving and verifying via subprocess
- Python orchestration (enrollment store, session/challenge tracker, prover/verifier wrappers)
- LLM-driven security audit of the deployment configuration

## How it works

```
                 ENROLL                                       AUTHENTICATE
   client                          server          client                          server
   ------                          ------          ------                          ------
   pick secret s
   send (user, ?)                                  request login (user)  ───►
                              picks salt                                     issue challenge c
                              ?                                              ◄───
   compute commitment =
     Poseidon(s, salt)                              compute Groth16 proof
   send commitment      ───►                          witness:  s, salt, c, commitment
                              store                  proof binds:
                              (user, commit, salt)     Poseidon(s, salt)      == commitment
                                                       Poseidon(s, c)         -> response
                                                  send (proof, public_signals) ───►
                                                                                  verify proof
                                                                                  check enrolled
                                                                                    salt+commitment
                                                                                  consume challenge
                                                                                  ◄─── ok
```

The `commitment === Poseidon(s, salt)` constraint is the knowledge proof. The `challenge -> response` constraint binds the proof to the session: a captured proof cannot be replayed against a different challenge, and the server tracks single-use challenge consumption to prevent in-window replay.

## Layout

```
circuits/auth.circom            # Poseidon-based authentication circuit
scripts/setup.sh                # compile + Groth16 trusted-setup ceremony
build/                          # generated artifacts (auth.r1cs, auth.wasm, auth_final.zkey, verification_key.json)
zkauth/
  poseidon.py                   # Poseidon hash via circomlibjs (Node helper)
  enrollment.py                 # commitment registration store
  session.py                    # challenge issuance, TTL, single-use enforcement
  prover.py                     # snarkjs witness-calculate + prove
  verifier.py                   # snarkjs verify + public-signal binding
  audit.py                      # LLM auditor producing structured ZK posture report
  cli.py                        # zkauth {enroll, prove, verify, audit}
  _node_helpers/poseidon.cjs    # Node CLI for circomlibjs Poseidon
tests/test_zkauth.py            # 29 unit + live LLM smoke
```

## Quick start

```bash
# Install Node deps (one-time)
npm install -g circom circomlib circomlibjs snarkjs

# Generate circuit + Groth16 keys (one-time, ~30s)
bash scripts/setup.sh

# Python deps + tests
pip install -r requirements.txt
pytest tests/ -v
LLM_LIVE=1 pytest tests/ -v
```

## CLI

```bash
# Enroll a user
python -m zkauth.cli --state-dir state enroll alice 0xC0FFEE

# (server) issue a challenge -- here we hard-code one for the demo
CHALLENGE=12345

# (client) generate a proof
python -m zkauth.cli --state-dir state prove alice 0xC0FFEE $CHALLENGE > bundle.json

# (server) verify
python -m zkauth.cli --state-dir state verify alice bundle.json

# LLM audit of the deployment posture
python -m zkauth.cli audit --participants 1 --ttl 60 --rotation 90
```

## Performance

| Operation               | Wall time |
|-------------------------|-----------|
| Witness calculation     | ~0.3 s    |
| Groth16 prove           | ~0.7 s    |
| Groth16 verify          | ~0.5 s    |
| Trusted setup (PoT 12)  | ~25 s (one-time) |

Benchmarked on this circuit: 481 non-linear constraints, 4 public signals.

## Threat model

- **Server compromise** does not leak the user secret; only commitments and salts are stored.
- **Network observer** sees only the proof + public signals; the secret never leaves the client.
- **Proof replay** is blocked at two layers: (1) the server's `AuthSession` records single-use of each challenge, (2) the SNARK itself binds the proof to that exact challenge.
- **Wrong-secret attempts** fail at witness calculation -- no proof is even produced.
- **Trusted setup** must be replaced for production with a multi-party MPC ceremony; the demo runs a single contributor.

## License

MIT
