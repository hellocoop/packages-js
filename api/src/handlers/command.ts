// process OP Commands

import { HelloRequest, HelloResponse, CommandHandler, Command, CommandClaims } from '../types'
import config from '../lib//config'
import { PackageMetadata } from '../lib/packageMetadata';

// TODO -- design pluggable command handler interface

type MetadataResponse = {
    context: {
        package_name: string,
        package_version: string,
        iss: string,
        tenant?: string
    },
    commands_uri: string,
    commands_supported: Command[],
    commands_ttl: number,
    client_id: string
}

interface OpenIDProviderMetadata {
    issuer: string;
    introspection_endpoint: string;
    jwks_uri: string;
}

const issuers: Record<string, OpenIDProviderMetadata> = {};

const verifyCommandToken = async (command_token: string) => {

    const [ encodedHeader, encodedPayload, signature ] = command_token.split('.')
    if (!encodedHeader || !encodedPayload || !signature) {
        return false
    }
    try {
        const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString())
        const iss = header?.iss
        if (!iss) {
            return false
        }
        if (!issuers[iss]) {
            const configURI = iss+'.well-known/openid-configuration'
            const response = await fetch(configURI)
            if (!response.ok) {
                return false
            }
            issuers[iss] = await response.json()
        }
        const introspection_endpoint = issuers[iss].introspection_endpoint
        if (!introspection_endpoint) {
            return false
        }
        const data = new URLSearchParams()
        data.append('token', command_token)
        data.append('client_id', config.clientId || 'test-app')
        const response = await fetch(introspection_endpoint, {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: data.toString()
        })
        if (!response.ok) {
            return false
        }
        const json = await response.json()
        return json
    }
    catch (e) {
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
        commands_uri: config.redirectURI || '', // might not be set
        commands_supported: ['metadata'],
        commands_ttl: 0,
        client_id: config.clientId || ''
    }
    if (tenant)
        metadataResponse.context.tenant = tenant
    return res.json(metadataResponse)
}

function getClaims(payload: string) {
    // Convert URL-safe Base64 to standard Base64
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  
    // Decode Base64 to text
    const buffer = Buffer.from(base64, 'base64');
    const jsonString = buffer.toString('utf-8');
    const json = JSON.parse(jsonString);
    return json
  }


const handleCommand = async (req: HelloRequest, res: HelloResponse, params:  {[key: string]: string }) => {
    const { command_token } = params
    if (!command_token) {
        // should not happen
        return res.status(500)
    }

    var claims = await verifyCommandToken(command_token)

    if (!claims) {
        res.status(400)
        console.error('invalid command token', command_token)
        return res.json({error: 'invalid_request', error_description: 'invalid command token'})
    }

    const { command } = claims as CommandClaims

    const commandsConfigured = config.commandHandler
    
    if (!commandsConfigured && (command === 'metadata')) {
        return handleMetadata(res, claims)
    }

    if (config.commandHandler) {
        return config.commandHandler(res, claims)
    }           

    res.status(400)
    return res.json({error: 'unsupported_command'})
}

export default handleCommand