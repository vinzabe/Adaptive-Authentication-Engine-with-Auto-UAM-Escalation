pragma circom 2.0.0;

include "poseidon.circom";

/*
 *  zk-auth: knowledge-of-preimage authentication.
 *
 *  Public inputs:
 *      commitment      - Poseidon(secret, salt) registered at enrollment
 *      salt            - per-user random salt, public
 *      challenge       - server-issued nonce; folded into the proof so the
 *                        same proof cannot be replayed for a different
 *                        challenge.
 *
 *  Private input:
 *      secret          - the user's secret pre-image
 *
 *  Constraints:
 *      1.  Poseidon(secret, salt)               == commitment
 *      2.  Poseidon(secret, challenge)          == challenge_response
 *
 *  The second constraint binds the proof to the challenge: a verifier that
 *  knows `challenge_response` (recomputed from its own session) cannot accept
 *  a proof that was generated against a different challenge.
 */

template ZkAuth() {
    signal input secret;             // private
    signal input salt;               // public
    signal input challenge;          // public
    signal input commitment;         // public
    signal output challenge_response; // public output

    // Hash 1: Poseidon(secret, salt) == commitment
    component h1 = Poseidon(2);
    h1.inputs[0] <== secret;
    h1.inputs[1] <== salt;
    h1.out === commitment;

    // Hash 2: Poseidon(secret, challenge) -> challenge_response (public output)
    component h2 = Poseidon(2);
    h2.inputs[0] <== secret;
    h2.inputs[1] <== challenge;
    challenge_response <== h2.out;
}

component main {public [salt, challenge, commitment]} = ZkAuth();
