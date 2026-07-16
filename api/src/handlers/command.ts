// process OP Commands
// implements OpenID Provider Commands draft-02
// https://github.com/openid/openid-provider-commands

import {
    createRemoteJWKSet,
    decodeJwt,
    decodeProtectedHeader,
    jwtVerify,
} from 'jose'
import {
    HelloRequest,
    HelloResponse,
    CommandHandler,
    Command,
    CommandClaims,
} from '../types'
import config from '../lib/config'

const COMMAND_TOKEN_TYP = 'command+jwt'

// claims every Command Token must carry (draft-02 baseline)
const REQUIRED_CLAIMS = [
    'iss',
    'aud',
    'client_id',
    'iat',
    'exp',
    'jti',
    'command',
    'tenant',
]

type MetadataResponse = {
    context: {
        iss: string
        tenant: string
    }
    command_endpoint: string
    commands_supported: Command[]
    client_id: string
    aud_sub_required?: boolean
}

interface CommandIssuer {
    issuer: string
    jwks_uri?: string // discovered via .well-known/openid-configuration if not set
}

// OPs recognized as command issuers -- exported so tests can register issuers
export const commandIssuers: Record<string, CommandIssuer> = {
    'http://mockin:3333': {
        // mock issuer
        issuer: 'http://mockin:3333',
    },
    'http://127.0.0.1:3333': {
        // test issuer
        issuer: 'http://127.0.0.1:3333',
    },
    'https://issuer.hello.coop': {
        // production issuer
        issuer: 'https://issuer.hello.coop',
        jwks_uri: 'https://issuer.hello.coop/.well-known/jwks.json',
    },
}

const jwksCache: Record<string, ReturnType<typeof createRemoteJWKSet>> = {}

const getJWKS = async (issuer: CommandIssuer) => {
    const cached = jwksCache[issuer.issuer]
    if (cached) return cached
    let jwks_uri = issuer.jwks_uri
    if (!jwks_uri) {
        const configURL =
            issuer.issuer.replace(/\/$/, '') +
            '/.well-known/openid-configuration'
        const response = await fetch(configURL)
        if (!response.ok)
            throw new Error(`could not fetch ${configURL}: ${response.status}`)
        const json = await response.json()
        if (!json.jwks_uri)
            throw new Error(`no jwks_uri in ${configURL} response`)
        jwks_uri = json.jwks_uri as string
        issuer.jwks_uri = jwks_uri
    }
    const jwks = createRemoteJWKSet(new URL(jwks_uri))
    jwksCache[issuer.issuer] = jwks
    return jwks
}

type VerifyResult =
    | { claims: CommandClaims }
    | { status: 400 | 401; error: string; error_description: string }

const invalidRequest = (error_description: string): VerifyResult => ({
    status: 400,
    error: 'invalid_request',
    error_description,
})

const verifyCommandToken = async (
    command_token: string,
    commandEndpoint: string,
): Promise<VerifyResult> => {
    let iss: string | undefined
    try {
        const header = decodeProtectedHeader(command_token)
        if (header.typ !== COMMAND_TOKEN_TYP)
            return invalidRequest(`"typ" header must be "${COMMAND_TOKEN_TYP}"`)
        iss = decodeJwt(command_token).iss
    } catch {
        return invalidRequest('malformed command token')
    }
    if (!iss) return invalidRequest('missing iss claim')
    const issuer = commandIssuers[iss]
    if (!issuer) {
        console.error('commands.verifyCommandToken: unknown issuer', iss)
        return {
            status: 401,
            error: 'unrecognized_provider',
            error_description: `unrecognized iss ${iss}`,
        }
    }
    try {
        const jwks = await getJWKS(issuer)
        const { payload } = await jwtVerify(command_token, jwks, {
            issuer: iss,
            audience: commandEndpoint,
            typ: COMMAND_TOKEN_TYP,
            requiredClaims: REQUIRED_CLAIMS,
        })
        if ('nonce' in payload)
            // prohibited to prevent cross-JWT confusion
            return invalidRequest('nonce claim must not be present')
        return { claims: payload as CommandClaims }
    } catch (e) {
        console.error('commands.verifyCommandToken:', e)
        return invalidRequest('command token verification failed')
    }
}

// the Command Endpoint is the URL the Command Token was sent to,
// and is the required aud value of the Command Token
const getCommandEndpoint = (req: HelloRequest): string | undefined => {
    if (config.redirectURI && config.redirectURI !== 'not-configured')
        return config.redirectURI
    // HOST is not configured -- derive from the request
    const headers = req.headers()
    const host = headers['x-forwarded-host'] || headers['host']
    if (!host) return undefined
    const protocol =
        headers['x-forwarded-proto'] ||
        (host.startsWith('localhost') || host.startsWith('127.0.0.1')
            ? 'http'
            : 'https')
    return `${protocol}://${host}${config.apiRoute}`
}

const makeMetadataHandler = (commandEndpoint: string): CommandHandler => {
    return (res, claims) => {
        const { iss, tenant } = claims
        const metadataResponse: MetadataResponse = {
            context: {
                iss,
                tenant,
            },
            command_endpoint: commandEndpoint,
            commands_supported: config.commandsSupported || ['metadata'],
            client_id: config.clientId || 'unknown',
        }
        if (config.audSubRequired !== undefined)
            metadataResponse.aud_sub_required = config.audSubRequired
        return res.json(metadataResponse)
    }
}

const handleCommand = async (
    req: HelloRequest,
    res: HelloResponse,
    params: { [key: string]: string },
) => {
    res.setHeader('Cache-Control', 'no-store')

    const { command_token } = params
    if (!command_token) {
        res.status(400)
        return res.json({
            error: 'invalid_request',
            error_description: 'missing command_token',
        })
    }

    const commandEndpoint = getCommandEndpoint(req)
    if (!commandEndpoint) {
        console.error(
            'commands: could not determine command endpoint -- set HELLO_HOST',
        )
        res.status(500)
        return res.json({ error: 'server_error' })
    }

    const result = await verifyCommandToken(command_token, commandEndpoint)

    if ('error' in result) {
        console.error('invalid command token', result)
        res.status(result.status)
        return res.json({
            error: result.error,
            error_description: result.error_description,
        })
    }

    const { claims } = result
    const { command } = claims

    // metadata is always handled built-in, sourced from config,
    // so a commandHandler only ever receives the other commands
    if (command === 'metadata') {
        return makeMetadataHandler(commandEndpoint)(res, claims)
    }

    if (config.commandHandler) {
        if (
            config.commandsSupported &&
            !config.commandsSupported.includes(command)
        ) {
            res.status(400)
            return res.json({ error: 'unsupported_command' })
        }
        return config.commandHandler(res, claims)
    }

    res.status(400)
    return res.json({ error: 'unsupported_command' })
}

export default handleCommand
