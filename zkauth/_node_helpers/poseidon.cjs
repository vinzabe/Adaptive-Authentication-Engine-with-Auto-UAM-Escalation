#!/usr/bin/env node
/* Poseidon hash CLI helper for zk-auth.
 *
 * Reads a JSON array of decimal-string field elements on argv[2] (or stdin)
 * and prints the BN254 Poseidon hash as a decimal string on stdout.
 *
 * Wraps circomlibjs.buildPoseidon() so the hash output matches the constraints
 * of the on-chain Poseidon template included in circomlib/circuits/poseidon.circom.
 */
const { buildPoseidon } = require("circomlibjs");

(async () => {
  try {
    let raw = process.argv[2];
    if (!raw) {
      raw = await new Promise((res, rej) => {
        let data = "";
        process.stdin.on("data", c => data += c);
        process.stdin.on("end", () => res(data));
        process.stdin.on("error", rej);
      });
    }
    const inputs = JSON.parse(raw);
    if (!Array.isArray(inputs) || inputs.length === 0) {
      throw new Error("expected non-empty array of field elements");
    }
    const bigs = inputs.map(s => BigInt(String(s)));
    const p = await buildPoseidon();
    const out = p(bigs);
    process.stdout.write(p.F.toString(out));
  } catch (e) {
    process.stderr.write(String(e && e.stack || e));
    process.exit(2);
  }
})();
