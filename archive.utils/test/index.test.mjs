
import test from 'node:test';

import { pkce, verifyChallenge, generateChallenge } from "../dist/pkce.js ";

test("default verifier length is 43", async () => {
  const result = await pkce();
  assert.strictEqual(result.code_verifier.length, 43);
});

test("code_verifier pattern matches", async () => {
  const pattern = /^[A-Za-z\d\-._~]{43,128}$/;
  const challengePair = await pkce();
  assert.ok(pattern.test(challengePair.code_verifier));
});

test("code_challenge pattern doesn't have [=+/]", async () => {
  const challengePair = await pkce();
  assert.ok(!challengePair.code_challenge.includes("="));
  assert.ok(!challengePair.code_challenge.includes("+"));
  assert.ok(!challengePair.code_challenge.includes("/"));
});

test("verifyChallenge should return true", async () => {
  const challengePair = await pkce();
  assert.strictEqual(
    await verifyChallenge(challengePair.code_verifier, challengePair.code_challenge),
    true
  );
});

test("verifyChallenge should return false", async () => {
  const challengePair = await pkce();
  assert.strictEqual(
    await verifyChallenge(
      challengePair.code_verifier,
      challengePair.code_challenge + "a"
    ),
    false
  );
});

test("generateChallenge should create a consistent challenge from a code_verifier", async () => {
  const challengePair = await pkce();
  const code_challenge = await generateChallenge(challengePair.code_verifier);
  assert.strictEqual(code_challenge, challengePair.code_challenge);
});
