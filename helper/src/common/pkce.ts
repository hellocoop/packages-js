/*
  derived from the solid work at https://github.com/crouchcd/pkce-challenge
*/

// we will get the crypto object from the parent package

let crypto: any
export let uuidv4: any

export const setCrypto = function (c: any) {
    crypto = c
    uuidv4 = c.randomUUID.bind(c) // bind method to the crypto object
}

const VERIFIER_LENGTH = 43

// export const uuidv4 = crypto.randomUUID

/** Generate cryptographically strong random string
 * @param size The desired length of the string
 * @returns The random string
 */
function generateVerifier() {
    const mask =
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~'
    let result = ''
    const randomUints = crypto.getRandomValues(new Uint8Array(VERIFIER_LENGTH))
    for (let i = 0; i < VERIFIER_LENGTH; i++) {
        // cap the value of the randomIndex to mask.length - 1
        const randomIndex = randomUints[i] % mask.length
        result += mask[randomIndex]
    }
    return result
}

/** Generate a PKCE code challenge from a code verifier
 * @param code_verifier
 * @returns The base64 url encoded code challenge
 */
export async function generateChallenge(code_verifier: string) {
    const buffer = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(code_verifier),
    )
    // Generate base64url string
    // btoa is deprecated in Node.js but is used here for web browser compatibility
    // (which has no good replacement yet, see also https://github.com/whatwg/html/issues/6811)
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
        .replace(/\//g, '_')
        .replace(/\+/g, '-')
        .replace(/=/g, '')
}

/** Generate a PKCE challenge pair
 * @param length Length of the verifer (between 43-128). Defaults to 43.
 * @returns PKCE challenge pair
 */
export async function pkce(): Promise<{
    code_verifier: string
    code_challenge: string
}> {
    const verifier = generateVerifier()
    const challenge = await generateChallenge(verifier)

    return {
        code_verifier: verifier,
        code_challenge: challenge,
    }
}

/** Verify that a code_verifier produces the expected code challenge
 * @param code_verifier
 * @param expectedChallenge The code challenge to verify
 * @returns True if challenges are equal. False otherwise.
 */
export async function verifyChallenge(
    code_verifier: string,
    expectedChallenge: string,
) {
    const actualChallenge = await generateChallenge(code_verifier)
    return actualChallenge === expectedChallenge
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
