// Tests for the OPC draft-02 command handler
// spins up a local issuer that serves openid-configuration + JWKS,
// mints command+jwt tokens, and drives handleCommand directly

import './setup.js'

import { test, before, after } from 'node:test'
import assert from 'node:assert'
import http from 'node:http'
import { AddressInfo } from 'node:net'
import { generateKeyPair, exportJWK, SignJWT, JWK, KeyLike } from 'jose'

import { configure } from '../src/lib/config.js'
import handleCommand, { commandIssuers } from '../src/handlers/command.js'
import {
    HelloRequest,
    HelloResponse,
    CommandClaims,
    Config,
} from '../src/types.js'

const CLIENT_ID = 'test-client-id'
const COMMAND_ENDPOINT = 'https://rp.example.com/api/hellocoop'

let issuer: string
let server: http.Server
let privateKey: KeyLike
let wrongPrivateKey: KeyLike
let jti = 0

before(async () => {
    const keyPair = await generateKeyPair('RS256')
    privateKey = keyPair.privateKey
    const wrongKeyPair = await generateKeyPair('RS256')
    wrongPrivateKey = wrongKeyPair.privateKey
    const publicJwk: JWK = await exportJWK(keyPair.publicKey)
    publicJwk.kid = 'test-key'
    publicJwk.alg = 'RS256'
    publicJwk.use = 'sig'

    server = http.createServer((req, res) => {
        if (req.url === '/.well-known/openid-configuration') {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ issuer, jwks_uri: issuer + '/jwks' }))
        } else if (req.url === '/jwks') {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ keys: [publicJwk] }))
        } else {
            res.statusCode = 404
            res.end()
        }
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as AddressInfo
    issuer = `http://127.0.0.1:${port}`
    commandIssuers[issuer] = { issuer }
})

after(() => {
    server.close()
})

type MintOptions = {
    typ?: string
    iss?: string
    aud?: string
    key?: KeyLike
    expired?: boolean
    claims?: Record<string, unknown>
    omit?: string[]
}

const mintToken = async (options: MintOptions = {}) => {
    const now = Math.floor(Date.now() / 1000)
    const payload: Record<string, unknown> = {
        iss: options.iss ?? issuer,
        aud: options.aud ?? COMMAND_ENDPOINT,
        client_id: CLIENT_ID,
        iat: options.expired ? now - 600 : now,
        exp: options.expired ? now - 300 : now + 120,
        jti: `jti-${++jti}`,
        command: 'metadata',
        tenant: 'personal',
        ...options.claims,
    }
    for (const claim of options.omit || []) delete payload[claim]
    return new SignJWT(payload)
        .setProtectedHeader({
            alg: 'RS256',
            kid: 'test-key',
            typ: options.typ ?? 'command+jwt',
        })
        .sign(options.key ?? privateKey)
}

const mockReq = () =>
    ({
        headers: () => ({ host: 'rp.example.com' }),
        method: 'POST',
        path: '/api/hellocoop',
        query: {},
    }) as unknown as HelloRequest

type CapturedResponse = {
    statusCode: number
    body: any
    headers: Record<string, string | string[]>
}

const mockRes = (): { res: HelloResponse; captured: CapturedResponse } => {
    const captured: CapturedResponse = {
        statusCode: 200,
        body: undefined,
        headers: {},
    }
    const res = {
        setHeader: (name: string, value: string | string[]) => {
            captured.headers[name.toLowerCase()] = value
        },
        status: (statusCode: number) => {
            captured.statusCode = statusCode
            return {
                send: (data: any) => {
                    captured.body = data
                },
            }
        },
        json: (data: any) => {
            captured.body = data
        },
        send: (data: any) => {
            captured.body = data
        },
    } as unknown as HelloResponse
    return { res, captured }
}

const runCommand = async (
    command_token: string | undefined,
    config: Config = {},
) => {
    configure({ client_id: CLIENT_ID, ...config })
    const { res, captured } = mockRes()
    const params: { [key: string]: string } = {}
    if (command_token) params.command_token = command_token
    await handleCommand(mockReq(), res, params)
    return captured
}

test('metadata command: valid token returns draft-02 metadata response', async () => {
    const captured = await runCommand(await mintToken())
    assert.strictEqual(captured.statusCode, 200)
    assert.strictEqual(captured.headers['cache-control'], 'no-store')
    const metadata = captured.body
    assert.deepStrictEqual(metadata.context, {
        iss: issuer,
        tenant: 'personal',
    })
    assert.strictEqual(metadata.command_endpoint, COMMAND_ENDPOINT)
    assert.deepStrictEqual(metadata.commands_supported, ['metadata'])
    assert.strictEqual(metadata.client_id, CLIENT_ID)
    // draft-00/01 fields are gone
    assert.ok(!('commands_uri' in metadata))
    assert.ok(!('commands_ttl' in metadata))
    assert.ok(!('aud_sub_required' in metadata))
    assert.ok(!('package_name' in metadata.context))
    assert.ok(!('package_version' in metadata.context))
})

test('metadata command: reflects commandsSupported and audSubRequired config', async () => {
    const captured = await runCommand(await mintToken(), {
        commandHandler: undefined,
        commandsSupported: ['metadata', 'suspend', 'delete'],
        audSubRequired: true,
    })
    assert.strictEqual(captured.statusCode, 200)
    assert.deepStrictEqual(captured.body.commands_supported, [
        'metadata',
        'suspend',
        'delete',
    ])
    assert.strictEqual(captured.body.aud_sub_required, true)
})

test('rejects token with wrong typ header', async () => {
    const captured = await runCommand(await mintToken({ typ: 'JWT' }))
    assert.strictEqual(captured.statusCode, 400)
    assert.strictEqual(captured.body.error, 'invalid_request')
})

test('rejects token with bad signature', async () => {
    const captured = await runCommand(await mintToken({ key: wrongPrivateKey }))
    assert.strictEqual(captured.statusCode, 400)
    assert.strictEqual(captured.body.error, 'invalid_request')
})

test('rejects token with wrong aud', async () => {
    const captured = await runCommand(
        await mintToken({ aud: 'https://other.example.com/command' }),
    )
    assert.strictEqual(captured.statusCode, 400)
    assert.strictEqual(captured.body.error, 'invalid_request')
})

test('rejects expired token', async () => {
    const captured = await runCommand(await mintToken({ expired: true }))
    assert.strictEqual(captured.statusCode, 400)
    assert.strictEqual(captured.body.error, 'invalid_request')
})

test('rejects token with nonce claim', async () => {
    const captured = await runCommand(
        await mintToken({ claims: { nonce: 'abc' } }),
    )
    assert.strictEqual(captured.statusCode, 400)
    assert.strictEqual(captured.body.error, 'invalid_request')
})

test('rejects token from unrecognized issuer with 401', async () => {
    const captured = await runCommand(
        await mintToken({ iss: 'https://unknown.example.org' }),
    )
    assert.strictEqual(captured.statusCode, 401)
    assert.strictEqual(captured.body.error, 'unrecognized_provider')
})

test('rejects token missing required claims', async () => {
    for (const claim of ['client_id', 'jti', 'command', 'tenant']) {
        const captured = await runCommand(await mintToken({ omit: [claim] }))
        assert.strictEqual(captured.statusCode, 400, `missing ${claim}`)
        assert.strictEqual(captured.body.error, 'invalid_request')
    }
})

test('rejects malformed token', async () => {
    const captured = await runCommand('not-a-jwt')
    assert.strictEqual(captured.statusCode, 400)
    assert.strictEqual(captured.body.error, 'invalid_request')
})

test('rejects request with no command_token', async () => {
    const captured = await runCommand(undefined)
    assert.strictEqual(captured.statusCode, 400)
    assert.strictEqual(captured.body.error, 'invalid_request')
})

test('configure() wires commandHandler and it receives verified claims', async () => {
    let received: CommandClaims | undefined
    const captured = await runCommand(
        await mintToken({
            claims: { command: 'suspend', sub: 'user-123' },
        }),
        {
            commandHandler: (res, claims) => {
                received = claims
                res.json({ sub: claims.sub, account_state: 'suspended' })
            },
            commandsSupported: ['metadata', 'suspend'],
        },
    )
    assert.strictEqual(captured.statusCode, 200)
    assert.ok(received)
    assert.strictEqual(received.command, 'suspend')
    assert.strictEqual(received.sub, 'user-123')
    assert.strictEqual(received.iss, issuer)
    assert.strictEqual(received.client_id, CLIENT_ID)
    assert.deepStrictEqual(captured.body, {
        sub: 'user-123',
        account_state: 'suspended',
    })
})

test('account command with no commandHandler returns unsupported_command', async () => {
    const captured = await runCommand(
        await mintToken({ claims: { command: 'suspend', sub: 'user-123' } }),
    )
    assert.strictEqual(captured.statusCode, 400)
    assert.strictEqual(captured.body.error, 'unsupported_command')
})

test('command not in commandsSupported returns unsupported_command without calling handler', async () => {
    let called = false
    const captured = await runCommand(
        await mintToken({ claims: { command: 'delete', sub: 'user-123' } }),
        {
            commandHandler: () => {
                called = true
            },
            commandsSupported: ['metadata', 'suspend'],
        },
    )
    assert.strictEqual(captured.statusCode, 400)
    assert.strictEqual(captured.body.error, 'unsupported_command')
    assert.strictEqual(called, false)
})

test('registered commandHandler overrides built-in metadata', async () => {
    const captured = await runCommand(await mintToken(), {
        commandHandler: (res, claims) => {
            res.json({ custom: true, command: claims.command })
        },
    })
    assert.strictEqual(captured.statusCode, 200)
    assert.deepStrictEqual(captured.body, {
        custom: true,
        command: 'metadata',
    })
})
