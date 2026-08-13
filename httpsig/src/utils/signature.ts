/**
 * HTTP Message Signature generation and parsing utilities
 */

import { base64Encode, base64Decode, sha256 } from './base64.js'
import {
    ParsedSignatureInput,
    ParsedSignatureKey,
    SignatureKeyType,
    SignatureError,
    SignatureErrorCode,
    AcceptSignatureParams,
    HwkValue,
} from '../types.js'
import { invalidKey, unsupportedScheme } from '../errors.js'
import {
    parseDictionary,
    parseList,
    serializeDictionary,
    serializeList,
    serializeInnerList,
    isInnerList,
    isByteSequence,
    isValidTokenStr,
    bareItemToString,
    Token,
    ByteSequence,
} from '../structured-fields.js'
import type {
    Dictionary,
    InnerList,
    Item,
    Parameters,
} from '../structured-fields.js'

/**
 * Build the Inner List that a Signature-Input dictionary member carries: the
 * covered component identifiers, parameterized with `created`.
 *
 * Serialized, this is also the `@signature-params` component value. Both the
 * header and the signature base are produced from this one structure so they
 * cannot drift apart.
 */
function buildSignatureParams(
    components: string[],
    created: number,
): InnerList {
    const items: Item[] = components.map((component) => [
        component,
        new Map() as Parameters,
    ])
    return [items, new Map([['created', created]]) as Parameters]
}

/** Wrap a parse failure in a message naming the field that failed. */
function parseFailure(field: string, error: unknown): Error {
    const detail = error instanceof Error ? error.message : String(error)
    return new Error(`Invalid ${field} format: ${detail}`)
}

/**
 * Generate signature base string from components
 */
export function generateSignatureBase(
    components: string[],
    componentValues: Map<string, string>,
): string {
    const lines: string[] = []

    for (const component of components) {
        const value = componentValues.get(component)
        if (value === undefined) {
            throw new Error(`Missing value for component: ${component}`)
        }
        lines.push(`"${component}": ${value}`)
    }

    return lines.join('\n')
}

/**
 * Generate Signature-Input header value
 *
 * The `alg` signature parameter is deliberately never emitted. The algorithm
 * is signaled by the key, per the JOSE path of RFC 9421 Section 3.3.7, which
 * states that "the explicit alg signature parameter is not used at all when
 * using JOSE signing algorithms". Emitting it would create a second source of
 * truth in a namespace that does not correspond to the JWK `alg` anyway --
 * JWA values are not registered in the HTTP Signature Algorithms registry.
 */
export function generateSignatureInputHeader(
    label: string,
    components: string[],
    created: number,
): string {
    return serializeDictionary(
        new Map([[label, buildSignatureParams(components, created)]]),
    )
}

/**
 * Generate the `@signature-params` component value: the serialized Inner List
 * that the Signature-Input dictionary member for `label` carries.
 */
export function generateSignatureParams(
    components: string[],
    created: number,
): string {
    return serializeInnerList(buildSignatureParams(components, created))
}

/**
 * Generate Signature-Key header value as RFC 8941 Dictionary
 * Format: label=scheme;param1="value1";param2="value2"
 *
 * The scheme (hwk, jwt, jwks_uri, x509) is the item value, and
 * scheme-specific parameters are semicolon-separated.
 */
export function generateSignatureKeyHeader(
    label: string,
    signatureKey: SignatureKeyType,
    publicJwk?: JsonWebKey,
): string {
    /** One-member Dictionary: label=<scheme token>;<string parameters>. */
    const oneMember = (scheme: string, params: [string, string][]): string =>
        serializeDictionary(
            new Map([
                [label, [new Token(scheme), new Map(params) as Parameters]],
            ]) as Dictionary,
        )

    if (signatureKey.type === 'hwk') {
        if (!publicJwk) {
            throw new Error('Public JWK required for hwk signature key type')
        }

        // alg is REQUIRED and carries the algorithm; the verifier does not
        // derive it from kty and crv.
        if (!publicJwk.alg) {
            throw new Error(
                'Public JWK missing required alg member for hwk signature key type',
            )
        }

        // Build hwk parameters from JWK. kid is deliberately not emitted: the
        // key is inline, so an identifier selects nothing.
        const params: [string, string][] = [
            ['alg', publicJwk.alg],
            ['kty', publicJwk.kty as string],
        ]

        if (publicJwk.crv) params.push(['crv', publicJwk.crv])
        if (publicJwk.x) params.push(['x', publicJwk.x])
        if (publicJwk.y) params.push(['y', publicJwk.y])
        if (publicJwk.n) params.push(['n', publicJwk.n])
        if (publicJwk.e) params.push(['e', publicJwk.e])

        return oneMember('hwk', params)
    }

    if (signatureKey.type === 'jwt') {
        return oneMember('jwt', [['jwt', signatureKey.jwt]])
    }

    if (signatureKey.type === 'jkt_jwt') {
        return oneMember('jkt-jwt', [['jwt', signatureKey.jwt]])
    }

    if (signatureKey.type === 'jwks_uri') {
        return oneMember('jwks_uri', [
            ['id', signatureKey.id],
            ['dwk', signatureKey.dwk],
            ['kid', signatureKey.kid],
        ])
    }

    // Note: x509 scheme not yet implemented
    // Future implementation would look like:
    // if (signatureKey.type === 'x509') {
    //     return `${label}=x509;x5u="${signatureKey.x5u}";x5t="${signatureKey.x5t}"`
    // }
    // Recommended: use @peculiar/x509 for certificate parsing

    throw new Error(
        `Unsupported signature key type: ${(signatureKey as any).type}`,
    )
}

/**
 * Generate Signature header value
 */
export function generateSignatureHeader(
    label: string,
    signature: Uint8Array,
): string {
    return serializeDictionary(
        new Map([
            [
                label,
                [
                    new ByteSequence(base64Encode(signature)),
                    new Map() as Parameters,
                ],
            ],
        ]) as Dictionary,
    )
}

/**
 * Generate Content-Digest header value
 */
export async function generateContentDigest(body: BodyInit): Promise<string> {
    let bytes: Uint8Array

    if (typeof body === 'string') {
        bytes = new TextEncoder().encode(body)
    } else if (body instanceof Uint8Array) {
        bytes = body
    } else if (body instanceof ArrayBuffer) {
        bytes = new Uint8Array(body)
    } else if (Buffer.isBuffer(body)) {
        bytes = new Uint8Array(body)
    } else {
        // Refuse other types (ReadableStream, FormData, Blob, ...). Falling
        // through to String(body) here produced a valid signature over the
        // SHA-256 of literal text like "[object ReadableStream]" -- bytes
        // that never go on the wire and that no verifier can reproduce.
        throw new Error(
            `Cannot generate content-digest for body type: ${
                (body as any)?.constructor?.name ?? typeof body
            }`,
        )
    }

    const hash = await sha256(bytes)
    const encoded = base64Encode(hash)
    return `sha-256=:${encoded}:`
}

/**
 * Parse Signature-Input header: a Dictionary of Inner Lists with parameters.
 *
 * The Inner List is kept alongside the extracted component names, because
 * `@signature-params` is the serialization of that Inner List and is covered
 * by the signature. Re-deriving it from the extracted parts would risk
 * dropping a parameter the signer included.
 */
export function parseSignatureInput(header: string): ParsedSignatureInput[] {
    let dictionary: Dictionary
    try {
        dictionary = parseDictionary(header)
    } catch (error) {
        throw parseFailure('Signature-Input', error)
    }

    const results: ParsedSignatureInput[] = []

    for (const [label, member] of dictionary) {
        if (!isInnerList(member)) {
            throw new Error(
                `Invalid Signature-Input format: member "${label}" is not an Inner List of covered components`,
            )
        }

        const [items, parameters] = member

        const components: string[] = []
        for (const [bareItem, itemParameters] of items) {
            if (typeof bareItem !== 'string') {
                throw new Error(
                    'Invalid Signature-Input format: a covered component identifier must be a String',
                )
            }
            // Component parameters (;req, ;bs, ;sf, ;key, ;name) change what
            // the component value is and how the signature base line is
            // written. This implementation does not produce them, so rather
            // than silently signing over a base that ignores them, refuse.
            if (itemParameters.size > 0) {
                throw new Error(
                    `Unsupported component parameters on "${bareItem}" in Signature-Input`,
                )
            }
            components.push(bareItem)
        }

        const params: Record<string, any> = {}
        for (const [key, value] of parameters) {
            params[key] = value
        }

        // `created` is an Integer. A signer that omits it, or sends it as a
        // String, leaves the signature unbounded in time.
        if (typeof params.created !== 'number') {
            throw new Error(
                'Signature-Input missing required parameter: created',
            )
        }

        results.push({
            label,
            components,
            params: params as ParsedSignatureInput['params'],
            signatureParams: member,
        })
    }

    return results
}

/**
 * Parse Signature-Key header as RFC 8941 Dictionary
 * Format: label=scheme;param1="value1";param2="value2"
 *
 * The scheme (hwk, jwt, jwks_uri, x509) is the item value (a token),
 * and parameters are semicolon-separated key-value pairs.
 *
 * Per AAuth requirements:
 * - Must be a valid RFC 8941 Dictionary
 * - Must have exactly one dictionary member
 * - The member key is the label
 */
export function parseSignatureKey(header: string): ParsedSignatureKey[] {
    const malformed = new Error(
        'Invalid Signature-Key: must be RFC 8941 Dictionary with format label=scheme;params',
    )

    let dictionary: Dictionary
    try {
        dictionary = parseDictionary(header)
    } catch {
        throw malformed
    }

    // Exactly one member: the label the Signature and Signature-Input entries
    // are keyed by. More than one leaves which key signed the request
    // undetermined.
    if (dictionary.size !== 1) {
        throw new Error(
            'Invalid Signature-Key: must have exactly one dictionary member',
        )
    }

    const [label, member] = [...dictionary][0]

    // The member is an Item whose bare value is the scheme Token. An Inner
    // List, a String, a number, or a bare member (`sig` alone, meaning ?1) is
    // not a Signature-Key.
    if (isInnerList(member) || !(member[0] instanceof Token)) {
        throw malformed
    }

    const scheme = member[0].toString()

    // Scheme parameters are Strings. A Token is accepted for the same value --
    // a sender that omits the quotes around, say, `kty=EC` is unambiguous --
    // but anything that is not text is a type confusion, not a value.
    const params: Record<string, string> = {}
    for (const [key, value] of member[1]) {
        try {
            params[key] = bareItemToString(value)
        } catch {
            throw invalidKey(
                `Signature-Key ${key} parameter must be a String or Token`,
            )
        }
    }

    if (!['hwk', 'jwt', 'jkt-jwt', 'jwks_uri'].includes(scheme)) {
        throw unsupportedScheme(`Unsupported Signature-Key scheme: ${scheme}`)
    }

    if (scheme === 'hwk') {
        // Validate hwk has required parameters
        if (!params.kty) {
            throw invalidKey('Signature-Key hwk scheme missing kty parameter')
        }

        if (!params.alg) {
            throw invalidKey('Signature-Key hwk scheme missing alg parameter')
        }

        // The key is inline, so a kid selects nothing and one that disagrees
        // with the inline key has no defined resolution.
        if (params.kid !== undefined) {
            throw invalidKey(
                'Signature-Key hwk scheme MUST NOT include a kid parameter',
            )
        }

        // The hwk parameters are the JWK: alg and kty are checked present
        // above, the rest are the key material for whichever kty it is.
        return [{ label, type: 'hwk', value: params as unknown as HwkValue }]
    }

    if (scheme === 'jwt') {
        // Validate jwt has required parameters
        if (!params.jwt) {
            throw new Error('Signature-Key jwt scheme missing jwt parameter')
        }

        return [
            {
                label,
                type: 'jwt',
                value: { jwt: params.jwt },
            },
        ]
    }

    if (scheme === 'jkt-jwt') {
        // Validate jkt-jwt has required parameters
        if (!params.jwt) {
            throw new Error(
                'Signature-Key jkt-jwt scheme missing jwt parameter',
            )
        }

        return [
            {
                label,
                type: 'jkt_jwt',
                value: { jwt: params.jwt },
            },
        ]
    }

    if (scheme === 'jwks_uri') {
        // Validate jwks_uri has required parameters
        if (!params.id || !params.dwk || !params.kid) {
            throw new Error(
                'Signature-Key jwks_uri scheme missing required id/dwk/kid parameters',
            )
        }

        return [
            {
                label,
                type: 'jwks_uri',
                value: {
                    id: params.id,
                    kid: params.kid,
                    dwk: params.dwk,
                },
            },
        ]
    }

    // Note: the x509, jwks, and self-jwt schemes are not yet implemented.
    // Unknown and unimplemented schemes take the same defined path.

    throw unsupportedScheme(`Unsupported Signature-Key scheme: ${scheme}`)
}

/**
 * Generate Signature-Error header value as RFC 8941 Dictionary
 * Format: error=<code>[, required_input=("comp1" "comp2")]
 *
 * The supported_algorithms member was removed in -08. A server states what
 * would have worked in the Accept-Signature-Alg and Accept-Signature-Scheme
 * header fields, which work on a challenge and on an error alike.
 */
export function generateSignatureErrorHeader(
    signatureError: SignatureError,
): string {
    const dictionary: Dictionary = new Map([
        ['error', [new Token(signatureError.error), new Map()] as Item],
    ])

    if (signatureError.required_input) {
        dictionary.set('required_input', [
            signatureError.required_input.map((c) => [c, new Map()] as Item),
            new Map(),
        ])
    }

    return serializeDictionary(dictionary)
}

/**
 * Parse Signature-Error header (RFC 8941 Dictionary)
 */
export function parseSignatureError(header: string): SignatureError {
    let dictionary: Dictionary
    try {
        dictionary = parseDictionary(header)
    } catch (error) {
        throw parseFailure('Signature-Error', error)
    }

    const errorMember = dictionary.get('error')
    if (errorMember === undefined || isInnerList(errorMember)) {
        throw new Error('Invalid Signature-Error: missing error member')
    }

    const error = bareItemToString(errorMember[0]) as SignatureErrorCode
    const validCodes: SignatureErrorCode[] = [
        'unsupported_algorithm',
        'unsupported_scheme',
        'invalid_signature',
        'invalid_input',
        'invalid_request',
        'invalid_key',
        'unknown_key',
        'invalid_jwt',
        'expired_jwt',
        'issuer_missing',
        'issuer_mismatch',
    ]
    if (!validCodes.includes(error)) {
        throw new Error(`Invalid Signature-Error code: ${error}`)
    }

    const result: SignatureError = { error }

    // Parse required_input inner list
    const inputMember = dictionary.get('required_input')
    if (inputMember !== undefined) {
        if (!isInnerList(inputMember)) {
            throw new Error(
                'Invalid Signature-Error: required_input must be an Inner List',
            )
        }
        result.required_input = inputMember[0].map(([component]) =>
            bareItemToString(component),
        )
    }

    return result
}

/**
 * Generate an RFC 8941 List of Tokens.
 */
function generateTokenList(values: string[]): string {
    for (const value of values) {
        if (!isValidTokenStr(value)) {
            throw new Error(
                `Value is not a valid Structured Field Token: ${value}`,
            )
        }
    }
    return serializeList(values.map((value) => [new Token(value), new Map()]))
}

/**
 * Parse an RFC 8941 List of Tokens, ignoring entries that are not tokens.
 */
function parseTokenList(header: string): string[] {
    return parseList(header)
        .filter((member): member is Item => !isInnerList(member))
        .map(([bareItem]) => bareItem)
        .filter((bareItem): bareItem is Token => bareItem instanceof Token)
        .map((token) => token.toString())
}

/**
 * Generate Accept-Signature-Scheme: the Signature-Key schemes the server
 * accepts, in descending order of preference.
 *
 * Format: scheme1, scheme2
 */
export function generateAcceptSignatureSchemeHeader(schemes: string[]): string {
    return generateTokenList(schemes)
}

/**
 * Parse Accept-Signature-Scheme. Unrecognized tokens are preserved: a client
 * ignores what it does not know so a server may list schemes registered after
 * the client was written.
 */
export function parseAcceptSignatureScheme(header: string): string[] {
    return parseTokenList(header)
}

/**
 * Generate Accept-Signature-Alg: the signature algorithms the server accepts,
 * as fully-specified JOSE identifiers.
 *
 * Format: alg1, alg2
 */
export function generateAcceptSignatureAlgHeader(algs: string[]): string {
    return generateTokenList(algs)
}

/**
 * Parse Accept-Signature-Alg.
 */
export function parseAcceptSignatureAlg(header: string): string[] {
    return parseTokenList(header)
}

/**
 * Generate Accept-Signature header value
 * Format: label=("comp1" "comp2")[;alg="algo"][;tag="tag"]
 *
 * The sigkey parameter was removed in -08. A parameter value is a bare Item
 * and cannot be a list, so sigkey could name only one scheme. Use
 * Accept-Signature-Scheme and Accept-Signature-Alg instead.
 */
export function generateAcceptSignatureHeader(
    params: AcceptSignatureParams,
): string {
    const { label = 'sig', components, alg, tag } = params

    const parameters: Parameters = new Map()
    if (alg) {
        parameters.set('alg', alg)
    }
    if (tag) {
        parameters.set('tag', tag)
    }

    const innerList: InnerList = [
        components.map((c) => [c, new Map()] as Item),
        parameters,
    ]

    return serializeDictionary(new Map([[label, innerList]]))
}

/**
 * Parse Accept-Signature header
 * Format: label=("comp1" "comp2")[;alg="algo"][;tag="tag"]
 */
export function parseAcceptSignature(header: string): AcceptSignatureParams {
    const malformed = new Error('Invalid Accept-Signature format')

    let dictionary: Dictionary
    try {
        dictionary = parseDictionary(header)
    } catch {
        throw malformed
    }

    if (dictionary.size !== 1) {
        throw malformed
    }

    const [label, member] = [...dictionary][0]
    if (!isInnerList(member)) {
        throw malformed
    }

    const result: AcceptSignatureParams = {
        label,
        components: member[0].map(([component]) => bareItemToString(component)),
    }

    const alg = member[1].get('alg')
    if (alg !== undefined) {
        result.alg = bareItemToString(alg)
    }

    const tag = member[1].get('tag')
    if (tag !== undefined) {
        result.tag = bareItemToString(tag)
    }

    return result
}

/**
 * Parse Signature header
 */
export function parseSignature(header: string): Map<string, Uint8Array> {
    let dictionary: Dictionary
    try {
        dictionary = parseDictionary(header)
    } catch (error) {
        throw parseFailure('Signature', error)
    }

    const results = new Map<string, Uint8Array>()

    for (const [label, member] of dictionary) {
        // Format: label=:base64:
        if (isInnerList(member) || !isByteSequence(member[0])) {
            throw new Error(
                `Invalid Signature format: member "${label}" is not a Byte Sequence`,
            )
        }

        results.set(label, base64Decode(member[0].toBase64()))
    }

    return results
}
