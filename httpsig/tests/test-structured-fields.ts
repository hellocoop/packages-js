/**
 * RFC 8941 Structured Fields
 *
 * These cover the shapes that hand-rolled parsers get wrong. Every one of them
 * has a real failure behind it: a `;` inside a quoted string, an escape inside
 * a string, the Dictionary-of-Inner-Lists-with-parameters shape that
 * Signature-Input uses, Byte Sequences, and the Token/String distinction that
 * a regex-based parser erases.
 */

import { test } from 'node:test'
import assert from 'node:assert'
import {
    parseDictionary,
    parseList,
    parseItem,
    serializeDictionary,
    serializeList,
    serializeItem,
    serializeInnerList,
    bareItemToString,
    isInnerList,
    isByteSequence,
    Token,
    ByteSequence,
    verify,
} from '../src/index.js'
import type { BareItem, Item, InnerList, Parameters } from '../src/index.js'
import { generateSignatureBase } from '../src/utils/signature.js'
import { base64Encode } from '../src/utils/base64.js'

/** The member of a one-member Dictionary. */
function only(header: string) {
    const dictionary = parseDictionary(header)
    assert.strictEqual(dictionary.size, 1, `expected one member: ${header}`)
    return [...dictionary][0]
}

/* -------------------------------------------------------------------------
 * The AAuth-Requirement regression case
 * ---------------------------------------------------------------------- */

test("AAuth-Requirement: the specification's literal interaction example", () => {
    // This is the example a naive `split(";")` gets wrong. It is a Dictionary
    // with one member whose value is the Token `interaction`, carrying two
    // String parameters.
    const header =
        'requirement=interaction; url="https://resource.example/interaction"; code="A1B2-C3D4"'

    const [key, member] = only(header)
    assert.strictEqual(key, 'requirement')
    assert.ok(!isInnerList(member))

    const [value, params] = member as Item
    assert.ok(value instanceof Token, 'requirement value is a Token')
    assert.strictEqual(value.toString(), 'interaction')
    assert.strictEqual(
        params.get('url'),
        'https://resource.example/interaction',
    )
    assert.strictEqual(params.get('code'), 'A1B2-C3D4')
})

test('AAuth-Requirement: a `;` inside a quoted url does not split the parameters', () => {
    // The failure this whole exercise exists for. Splitting on `;` cuts the
    // url in half and loses `code` entirely.
    const header =
        'requirement=interaction; url="https://resource.example/i?a=1;b=2"; code="A1B2-C3D4"'

    const [, member] = only(header)
    const [, params] = member as Item

    assert.strictEqual(params.get('url'), 'https://resource.example/i?a=1;b=2')
    assert.strictEqual(params.get('code'), 'A1B2-C3D4')
    assert.strictEqual(params.size, 2, 'exactly two parameters')
})

test('AAuth-Requirement: auth-token with a resource token round-trips', () => {
    const header =
        'requirement=auth-token; resource-token="eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJhIn0.sig"'
    const [, member] = only(header)
    const [value, params] = member as Item

    assert.strictEqual((value as Token).toString(), 'auth-token')
    assert.strictEqual(
        params.get('resource-token'),
        'eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJhIn0.sig',
    )

    // Re-serialization is canonical: the optional space after `;` that RFC
    // 8941 allows on input is not emitted on output.
    assert.strictEqual(
        serializeDictionary(parseDictionary(header)),
        header.replace('; ', ';'),
    )
})

test('AAuth-Capabilities: a List of Tokens', () => {
    const list = parseList('interaction, auth-token, payment')
    assert.deepStrictEqual(
        list.map((member) => bareItemToString((member as Item)[0])),
        ['interaction', 'auth-token', 'payment'],
    )
    assert.strictEqual(serializeList(list), 'interaction, auth-token, payment')
})

/* -------------------------------------------------------------------------
 * Strings: quoting and escaping
 * ---------------------------------------------------------------------- */

test('String: an escaped double quote survives the round trip', () => {
    const [, member] = only('a="say \\"hello\\""')
    assert.strictEqual((member as Item)[0], 'say "hello"')

    assert.strictEqual(
        serializeItem([`say "hello"`, new Map()]),
        'a="say \\"hello\\""'.slice(2),
    )
})

test('String: an escaped backslash survives the round trip', () => {
    const [, member] = only('a="back\\\\slash"')
    assert.strictEqual((member as Item)[0], 'back\\slash')

    assert.strictEqual(
        serializeItem(['back\\slash', new Map()]),
        '"back\\\\slash"',
    )
})

test('String: a backslash before anything else is a parse error', () => {
    // RFC 8941 Section 3.3.3 permits only \\ and \" inside an sf-string.
    assert.throws(() => parseDictionary('a="new\\nline"'), /backslash/)
})

test('String: an unterminated string is a parse error, not a truncation', () => {
    assert.throws(() => parseDictionary('a="unterminated'), /Parse error/)
})

test('String: commas and semicolons inside a string do not end the member', () => {
    const dictionary = parseDictionary('a="x,y;z", b=2')
    assert.strictEqual(dictionary.size, 2)
    assert.strictEqual((dictionary.get('a') as Item)[0], 'x,y;z')
    assert.strictEqual((dictionary.get('b') as Item)[0], 2)
})

/* -------------------------------------------------------------------------
 * Tokens vs Strings
 * ---------------------------------------------------------------------- */

test('Token vs String: they are different values, not the same text', () => {
    const asToken = parseItem('interaction')[0]
    const asString = parseItem('"interaction"')[0]

    assert.ok(asToken instanceof Token)
    assert.strictEqual(typeof asString, 'string')
    assert.notStrictEqual(asToken, asString)

    // And they serialize back differently -- which is why erasing the
    // distinction breaks a signature base.
    assert.strictEqual(serializeItem([asToken, new Map()]), 'interaction')
    assert.strictEqual(serializeItem([asString, new Map()]), '"interaction"')
})

test('Token vs String: bareItemToString reads either, and refuses the rest', () => {
    assert.strictEqual(bareItemToString(new Token('hwk')), 'hwk')
    assert.strictEqual(bareItemToString('hwk'), 'hwk')
    assert.throws(() => bareItemToString(42), /String or Token/)
    assert.throws(() => bareItemToString(true), /String or Token/)
})

test('Token: a value that is not a valid token is a parse error', () => {
    // `@method` unquoted is not a Token -- component identifiers are Strings.
    assert.throws(() => parseList('@method'), /Parse error/)
})

/* -------------------------------------------------------------------------
 * Byte Sequences
 * ---------------------------------------------------------------------- */

test('Byte Sequence: parses base64 between colons', () => {
    const [, member] = only('sig=:aGVsbG8=:')
    const [value] = member as Item
    assert.ok(isByteSequence(value))
    assert.strictEqual((value as ByteSequence).toBase64(), 'aGVsbG8=')
})

test('Byte Sequence: base64 containing `+` and `/` is not mistaken for anything else', () => {
    const b64 = 'w6/Cr8O/w6s+PDw/Pg=='
    const [, member] = only(`sig=:${b64}:`)
    assert.strictEqual(((member as Item)[0] as ByteSequence).toBase64(), b64)
    assert.strictEqual(
        serializeDictionary(parseDictionary(`sig=:${b64}:`)),
        `sig=:${b64}:`,
    )
})

test('Byte Sequence: a missing closing colon is a parse error', () => {
    assert.throws(() => parseDictionary('sig=:aGVsbG8='), /closing/)
})

test('Byte Sequence: non-base64 content is rejected', () => {
    assert.throws(() => parseDictionary('sig=:not valid!:'), /base64/)
})

/* -------------------------------------------------------------------------
 * Dictionary of Inner Lists with parameters -- the Signature-Input shape
 * ---------------------------------------------------------------------- */

test('Signature-Input: Dictionary of Inner Lists with parameters', () => {
    const header =
        'sig-b26=("date" "@method" "@path" "@authority" "content-type" "content-length");created=1618884473;keyid="test-key-ed25519"'

    const [label, member] = only(header)
    assert.strictEqual(label, 'sig-b26')
    assert.ok(isInnerList(member), 'the member is an Inner List')

    const [items, params] = member as InnerList
    assert.deepStrictEqual(
        items.map(([component]) => component),
        [
            'date',
            '@method',
            '@path',
            '@authority',
            'content-type',
            'content-length',
        ],
    )
    assert.strictEqual(params.get('created'), 1618884473)
    assert.strictEqual(params.get('keyid'), 'test-key-ed25519')

    // Re-serializing the Inner List is how @signature-params is reproduced.
    assert.strictEqual(
        serializeInnerList(member as InnerList),
        header.slice('sig-b26='.length),
    )
})

test('Signature-Input: two signatures in one Dictionary', () => {
    const dictionary = parseDictionary(
        'sig1=("@method");created=1, sig2=("@path" "@authority");created=2;keyid="k"',
    )
    assert.deepStrictEqual([...dictionary.keys()], ['sig1', 'sig2'])
    assert.strictEqual((dictionary.get('sig2') as InnerList)[0].length, 2)
})

test('Signature-Input: an empty Inner List is valid', () => {
    const [, member] = only('sig=();created=1767021027;alg="ed25519"')
    assert.deepStrictEqual((member as InnerList)[0], [])
    assert.strictEqual((member as InnerList)[1].get('alg'), 'ed25519')
})

test('Signature-Input: a `;` inside a quoted keyid does not split the parameters', () => {
    const [, member] = only('sig=("@method");created=1;keyid="a;b";tag="c"')
    const params = (member as InnerList)[1]
    assert.strictEqual(params.get('keyid'), 'a;b')
    assert.strictEqual(params.get('tag'), 'c')
})

test('Signature-Input: an Inner List item may carry its own parameters', () => {
    // The grammar allows it even though this implementation refuses to sign
    // over one. Proving the parser sees them is what lets the refusal be
    // explicit rather than an accident.
    const [, member] = only(
        'sig=("@query-param";name="q" "host";req);created=1',
    )
    const [items] = member as InnerList
    assert.strictEqual(items[0][1].get('name'), 'q')
    assert.strictEqual(items[1][1].get('req'), true)
})

test('Signature-Input: a parameterized covered component is refused, not ignored', async () => {
    const result = await verify({
        method: 'GET',
        authority: 'api.example.com',
        path: '/data',
        headers: {
            'signature-key':
                'sig=hwk;alg="Ed25519";kty="OKP";crv="Ed25519";x="JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs"',
            'signature-input':
                'sig=("@method" "signature-key";req);created=1618884473',
            signature: 'sig=:dGVzdA==:',
        },
    })

    assert.strictEqual(result.verified, false)
    assert.match(result.error ?? '', /Unsupported component parameters/)
})

/* -------------------------------------------------------------------------
 * @signature-params fidelity
 * ---------------------------------------------------------------------- */

test('@signature-params: a Token-valued parameter is reproduced as a Token', async () => {
    // The old hand-rolled reconstruction quoted every non-numeric parameter,
    // so a signer that sent `;alg=hmac-sha256` (a Token) had it turned into
    // `;alg="hmac-sha256"` in the signature base and failed to verify. This
    // signs a request with a bare Token parameter and verifies it.
    const keyPair = (await crypto.subtle.generateKey(
        { name: 'Ed25519' },
        true,
        ['sign', 'verify'],
    )) as CryptoKeyPair
    const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)
    const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
    privateJwk.alg = 'Ed25519'
    publicJwk.alg = 'Ed25519'

    const created = Math.floor(Date.now() / 1000)
    const components = ['@method', '@authority', '@path', 'signature-key']
    const signatureKey =
        `sig=hwk;alg="Ed25519";kty="OKP";` +
        `crv="${publicJwk.crv}";x="${publicJwk.x}"`

    // Built with the serializer, so `alg` really is a bare Token.
    const innerList: InnerList = [
        components.map((c) => [c, new Map()] as Item),
        new Map<string, BareItem>([
            ['created', created],
            ['alg', new Token('hmac-sha256')],
        ]) as Parameters,
    ]
    const signatureParams = serializeInnerList(innerList)
    assert.ok(
        signatureParams.endsWith(';alg=hmac-sha256'),
        `alg must be unquoted, got: ${signatureParams}`,
    )

    const base = generateSignatureBase(
        [...components, '@signature-params'],
        new Map([
            ['@method', 'GET'],
            ['@authority', 'api.example.com'],
            ['@path', '/data'],
            ['signature-key', signatureKey],
            ['@signature-params', signatureParams],
        ]),
    )

    const signature = new Uint8Array(
        await crypto.subtle.sign(
            { name: 'Ed25519' },
            keyPair.privateKey,
            new TextEncoder().encode(base),
        ),
    )

    const result = await verify({
        method: 'GET',
        authority: 'api.example.com',
        path: '/data',
        headers: {
            'signature-key': signatureKey,
            'signature-input': `sig=${signatureParams}`,
            signature: `sig=:${base64Encode(signature)}:`,
        },
    })

    assert.strictEqual(
        result.verified,
        true,
        `Token-valued parameter must survive re-serialization: ${result.error}`,
    )
})

/* -------------------------------------------------------------------------
 * Dictionary edge cases
 * ---------------------------------------------------------------------- */

test('Dictionary: a bare member means true', () => {
    const dictionary = parseDictionary('a, b=?0, c')
    assert.strictEqual((dictionary.get('a') as Item)[0], true)
    assert.strictEqual((dictionary.get('b') as Item)[0], false)
    assert.strictEqual((dictionary.get('c') as Item)[0], true)
})

test('Dictionary: a trailing comma is a parse error', () => {
    assert.throws(() => parseDictionary('a=1,'), /trailing comma/)
})

test('Dictionary: an empty header is an empty Dictionary', () => {
    assert.strictEqual(parseDictionary('').size, 0)
    assert.deepStrictEqual(parseList(''), [])
})

test('Dictionary: Integers and Decimals keep their types', () => {
    const dictionary = parseDictionary('i=42, n=-17, d=4.5')
    assert.strictEqual((dictionary.get('i') as Item)[0], 42)
    assert.strictEqual((dictionary.get('n') as Item)[0], -17)
    assert.strictEqual((dictionary.get('d') as Item)[0], 4.5)
    assert.strictEqual(serializeDictionary(dictionary), 'i=42, n=-17, d=4.5')
})

test('Item: trailing junk after a standalone Item is a parse error', () => {
    assert.throws(() => parseItem('a b'), /Unexpected characters at end/)
})
