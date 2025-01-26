// process OP Commands

import { HelloRequest, HelloResponse, CommandHandler, Command, CommandClaims } from '../types'
import config from '../lib//config'
import { PackageMetadata } from '../lib/PackageMetadata';

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

    var claims = null

    //NOTE: we are not verifying the command token in testing

    // TODO -- add genrating a mock metadata command token to mockin 
    // TODO -- add command token verification to Hello and mockin 
    // parse header to get the issuer so we know where to call
    // check we can actually process command before calling to verify the token
    
    if (true) { // testing for now | call Hh to verify the token if no command handler
        const parts = command_token.split('.')

        if (parts.length !== 3) {
            res.status(400)
            console.error('invalid command token - not 3 parts', command_token)
            return res.json({error: 'invalid_request', error_description: 'invalid command token - not 3 parts'})
        }

        try {
            claims = getClaims(parts[1])
        }
        catch (e) {
            res.status(400)
            console.error('invalid command token JSON', command_token)
            return res.json({error: 'invalid_request', error_description: 'invalid command token JSON'})
        }
    }

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