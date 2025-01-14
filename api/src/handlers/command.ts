// process OP Commands

import { HelloRequest, HelloResponse, CommandHandler, Command, CommandClaims } from '../types'
import jwt from 'jsonwebtoken'
import config from '../lib//config'


// TODO - fetch jwks from Hello server

type DescribeResponse = {
    context: {
        iss: string,
        org?: {
            id: string
        }
    },
    commands_uri: string,
    commands_supported: Command[],
    commands_ttl: number,
    client_id: string
}

const handleDescribe: CommandHandler = async (req, res, claims) => {
    const { iss, org } = claims
    const describeResponse: DescribeResponse = {
        context: {
            iss,
        },
        commands_uri: config.redirectURI || '', // might not be set
        commands_supported: ['describe'],
        commands_ttl: 0,
        client_id: config.clientId || ''
    }
    if (org?.id)
        describeResponse.context.org = { id: org.id }
    return res.json(describeResponse)
}

const handleCommand = async (req: HelloRequest, res: HelloResponse, params:  {[key: string]: string }) => {
    const { command_token } = params
    if (!command_token) {
        // should not happen
        return res.status(500)
    }

    // TODO - validate command token

    const token = jwt.decode(command_token, {complete: true})
    const claims = token?.payload as CommandClaims

    const { iss, sub, command, org, groups } = claims

    const commandsConfigured = config.commandHandler && config.commandsSupported?.length
    
    if (!commandsConfigured || ((command === 'describe') && !config.commandsSupported?.includes('describe'))) {
        return handleDescribe(req, res, claims)
    }
    if (!config.commandsSupported?.includes(command)) {
        res.status(400)
        return res.json({error: 'unsupported command'})
    }

    if (config.commandHandler) {
        return config.commandHandler(req, res, claims)
    }           

    res.status(400)
    return res.json({error: 'unsupported command'})
}

export default handleCommand