/*
  derived from the solid work at https://github.com/crouchcd/pkce-challenge
*/

// import { webcrypto} from 'node:crypto';

const VERIFIER_LENGTH = 43

// TODO - fix utils so can be used in browser
//
import type { webcrypto } from 'node:crypto'
const crypto: webcrypto.Crypto =
  // @ts-ignore
  globalThis.crypto?.webcrypto ?? // Node.js 16 REPL has globalThis.crypto as node:crypto
  // @ts-ignore
  globalThis.crypto // web browsers and Node.js 18+ 
  // Below code error: The current file is a CommonJS module and cannot use 'await' at the top level.
  // (await import("node:crypto")).webcrypto; // Node.js 16 non-REPL


// export const uuidv4 = crypto.randomUUID
export { randomUUID as uuidv4 } from 'crypto';

/** Generate cryptographically strong random string
 * @param size The desired length of the string
 * @returns The random string
 */
function generateVerifier() {
  const mask =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~";
  let result = "";
  const randomUints = crypto.getRandomValues(new Uint8Array(VERIFIER_LENGTH));
  for (let i = 0; i < VERIFIER_LENGTH; i++) {
    // cap the value of the randomIndex to mask.length - 1
    const randomIndex = randomUints[i] % mask.length;
    result += mask[randomIndex];
  }
  return result;
}

/** Generate a PKCE code challenge from a code verifier
 * @param code_verifier
 * @returns The base64 url encoded code challenge
 */
export async function generateChallenge(code_verifier: string) {
  const buffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(code_verifier)
  );
  // Generate base64url string
  // btoa is deprecated in Node.js but is used here for web browser compatibility
  // (which has no good replacement yet, see also https://github.com/whatwg/html/issues/6811)
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\//g, '_')
    .replace(/\+/g, '-')
    .replace(/=/g, '');
}

/** Generate a PKCE challenge pair
 * @param length Length of the verifer (between 43-128). Defaults to 43.
 * @returns PKCE challenge pair
 */
export async function pkce(): Promise<{
  code_verifier: string;
  code_challenge: string;
}> {

  const verifier = generateVerifier();
  const challenge = await generateChallenge(verifier);

  return {
    code_verifier: verifier,
    code_challenge: challenge,
  };
}

/** Verify that a code_verifier produces the expected code challenge
 * @param code_verifier
 * @param expectedChallenge The code challenge to verify
 * @returns True if challenges are equal. False otherwise.
 */
export async function verifyChallenge(
  code_verifier: string,
  expectedChallenge: string
) {
  const actualChallenge = await generateChallenge(code_verifier);
  return actualChallenge === expectedChallenge;
}


// export const encryptObj = async function ( obj: Record<string, any>, secret: string )
//     : Promise<string | undefined> {
//   try {
//       const plainText = JSON.stringify(obj)
//       // TBD encrypt cookie
//       const cryptoText = Buffer.from(plainText).toString('base64')
//       return cryptoText
//   } catch(e) {
//     console.log(e)
//   }
//   return undefined
// }

// export const decryptObj = async function ( cryptoText:string, secret: string )
//     : Promise< Record<string, any> | undefined> {

//   try {
//     const json = Buffer.from(cryptoText, 'base64').toString()
//     const obj = JSON.parse(json)
//     return obj
//   } catch(e) {
//     console.log(e)
//   }
//   return undefined
// }


