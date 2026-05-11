# Security Policy

## Reporting

Report vulnerabilities responsibly to the repository owner by email to **g@abejar.net** -- do not open public issues.

## Threat model

This library implements zero-knowledge password-style authentication. The intended adversary is a passive or active network attacker plus a partially-compromised server.

- **In-scope**: secret confidentiality, proof unforgeability under chosen-challenge, replay resistance within and across sessions.
- **Out-of-scope**: side channels in the prover host (timing/power), denial-of-service against the verifier, key custody on the client device.

## Trusted setup

The bundled `scripts/setup.sh` runs a **single-contributor** Groth16 ceremony, which is suitable only for development and testing. A production deployment **must** replace this with a multi-party MPC ceremony (e.g., Hermez or a Phase-2 contribution from multiple independent parties) and publish per-participant transcripts. Re-using the demo `auth_final.zkey` in production is a critical vulnerability.

## Replay protection

Each authentication uses a fresh server-issued challenge nonce. The challenge is bound into the proof through a Poseidon constraint, and the server's `AuthSession` enforces single-use semantics with TTL. Both layers must be intact: bypassing the session layer (e.g., serving stale challenges) breaks the protocol.

## Curve and parameters

- BN254 / `bn128` (Groth16). Provides ~100-bit security; consider BLS12-381 for higher security margins or post-quantum readiness work.
- `circomlib`'s Poseidon parameters are the supported version. Do not substitute a custom Poseidon variant without updating both prover and verifier.

## Side-channel notes

- Prover wall time leaks "a proof was generated", and is correlated with system load. It does *not* reveal the secret.
- The Node-subprocess Poseidon helper executes user-controlled inputs through `JSON.parse`. Inputs are reduced to BN254 scalars before being passed; injection is not feasible, but operators should still keep the helper out of multi-tenant Node contexts.

## Dependencies

- `circom`, `snarkjs`, `circomlib`, `circomlibjs` and `node` are exec'd as subprocesses. Verify your installs against the upstream releases and pin versions in production.
- The LLM auditor sends only deployment metadata (participant count, TTL, rotation cadence). No user secret, salt, commitment, or challenge ever leaves the verifier.
