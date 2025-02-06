// process OP Commands

import {
    HelloRequest,
    HelloResponse,
    CommandHandler,
    Command,
    CommandClaims,
} from '../types'
import config from '../lib//config'
import { PackageMetadata } from '../lib/packageMetadata'

// TODO -- design pluggable command handler interface

type MetadataResponse = {
    context: {
        package_name: string
        package_version: string
        iss: string
        tenant?: string
    }
    commands_uri: string
    commands_supported: Command[]
    commands_ttl: number
    client_id: string
}

interface OpenIDProviderMetadata {
    issuer: string
    introspection_endpoint: string
    jwks_uri?: string
}

const issuers: Record<string, OpenIDProviderMetadata> = {
    'http://mockin:3333': {
        // mock issuer
        issuer: 'http://mockin:3333',
        introspection_endpoint: 'http://mockin:3333/oauth/introspect',
    },
    'http://127.0.0.1:3333': {
        // test issuer
        issuer: 'http://127.0.0.1:3333',
        introspection_endpoint: 'http://127.0.0.1:3333/oauth/introspect',
    },
    'https://issuer.hello.coop': {
        // production issuer
        issuer: 'https://issuer.hello.coop',
        introspection_endpoint: 'https://wallet.hello.coop/oauth/introspect',
    },
}

const verifyCommandToken = async (command_token: string) => {
    const [encodedHeader, encodedPayload, signature] = command_token.split('.')
    if (!encodedHeader || !encodedPayload || !signature) {
        return false
    }
    try {
        const payload = JSON.parse(
            Buffer.from(encodedPayload, 'base64url').toString(),
        )
        const iss = payload?.iss
        if (!iss) {
            console.error(
                'commands.verifyCommandToken: missing issuer',
                payload,
            )
            return false
        }
        if (!issuers[iss]) {
            console.error('commands.verifyCommandToken: unknown issuer', iss)
            return false
        }
        const introspection_endpoint = issuers[iss].introspection_endpoint
        const data = new URLSearchParams()
        data.append('token', command_token)
        data.append('client_id', config.clientId || 'test-app')
        const response = await fetch(introspection_endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: data.toString(),
        })
        if (!response.ok) {
            console.error(
                'commands.verifyCommandToken: introspection failed',
                response.status,
            )
            return false
        }
        const json = await response.json()
        return json
    } catch (e) {
        console.error('error verifying command token', e)
        return false
    }
}

const handleMetadata: CommandHandler = async (res, claims) => {
    const { iss, tenant } = claims
    const { name, version } = PackageMetadata.getMetadata()
    const metadataResponse: MetadataResponse = {
        context: {
            package_name: name,
            package_version: version,
            iss,
        },
        commands_uri: config.redirectURI || 'unknown', // might not be set
        commands_supported: ['metadata'],
        commands_ttl: 0,
        client_id: config.clientId || 'unknown',
    }
    if (tenant) metadataResponse.context.tenant = tenant
    return res.json(metadataResponse)
}

const handleCommand = async (
    req: HelloRequest,
    res: HelloResponse,
    params: { [key: string]: string },
) => {
    const { command_token } = params
    if (!command_token) {
        // should not happen
        return res.status(500)
    }

    const claims = await verifyCommandToken(command_token)

    if (!claims) {
        res.status(400)
        console.error('invalid command token', command_token)
        return res.json({
            error: 'invalid_request',
            error_description: 'invalid command token',
        })
    }

    const { command } = claims as CommandClaims

    const commandsConfigured = config.commandHandler

    if (!commandsConfigured && command === 'metadata') {
        return handleMetadata(res, claims)
    }

    if (config.commandHandler) {
        return config.commandHandler(res, claims)
    }

    res.status(400)
    return res.json({ error: 'unsupported_command' })
}

export default handleCommand
