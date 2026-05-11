#!/usr/bin/env bash
# Compile auth.circom and run a Groth16 trusted setup ceremony.
#
# Output (under build/):
#   auth.r1cs              - rank-1 constraint system
#   auth_js/auth.wasm      - witness calculator wasm
#   auth.zkey              - proving key
#   verification_key.json  - verifying key
#
# This is a *demo* ceremony with a single contribution. A real production
# deployment must run a multi-party ceremony with audited entropy.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
BUILD="$ROOT/build"
CIRCUIT="$ROOT/circuits/auth.circom"
CIRCOMLIB="${CIRCOMLIB:-/usr/lib/node_modules/circomlib/circuits}"
PTAU_POWER="${PTAU_POWER:-12}"

mkdir -p "$BUILD"
cd "$BUILD"

if [ ! -f "auth.r1cs" ] || [ ! -f "auth_js/auth.wasm" ]; then
  echo "[setup] compiling circuit"
  circom "$CIRCUIT" --r1cs --wasm --sym -l "$CIRCOMLIB" -o "$BUILD"
fi

if [ ! -f "pot${PTAU_POWER}_final.ptau" ]; then
  echo "[setup] phase-1 powers of tau"
  snarkjs powersoftau new bn128 "$PTAU_POWER" "pot${PTAU_POWER}_0000.ptau" -v
  snarkjs powersoftau contribute \
    "pot${PTAU_POWER}_0000.ptau" "pot${PTAU_POWER}_0001.ptau" \
    --name="zk-auth-demo" -v -e="$(date +%s%N)"
  snarkjs powersoftau prepare phase2 \
    "pot${PTAU_POWER}_0001.ptau" "pot${PTAU_POWER}_final.ptau" -v
  rm -f "pot${PTAU_POWER}_0000.ptau" "pot${PTAU_POWER}_0001.ptau"
fi

if [ ! -f "auth_final.zkey" ] || [ ! -f "verification_key.json" ]; then
  echo "[setup] phase-2 (Groth16) for auth"
  snarkjs groth16 setup auth.r1cs "pot${PTAU_POWER}_final.ptau" auth_0000.zkey
  snarkjs zkey contribute \
    auth_0000.zkey auth_final.zkey \
    --name="zk-auth-demo" -v -e="$(date +%s%N)"
  snarkjs zkey export verificationkey auth_final.zkey verification_key.json
  rm -f auth_0000.zkey
fi

echo "[setup] done. artifacts:"
ls -la "$BUILD"/auth_final.zkey "$BUILD"/verification_key.json \
       "$BUILD"/auth_js/auth.wasm
