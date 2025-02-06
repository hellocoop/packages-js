// express quickstart

import { statSync, appendFileSync } from 'fs'
import chalk from 'chalk'
import fs from 'fs-extra'
import quickstart from './index.js'
import { randomBytes } from 'crypto'

const HELLO_CONFIG_FILE = 'hello.config.js'
const ENV_FILE = '.env'

import dotenv from 'dotenv'

// TODO  check if @hellocoop/express is installed

const writeConfig = async (options, name) => {
    const client_id = await quickstart(options)

    const filePath = process.cwd() + '/' + HELLO_CONFIG_FILE
    try {
        statSync(filePath)
        const append = `
// added by @hellocoop/quickstart --${name} on ${new Date().toISOString()}
config.client_id = '${client_id}'
`
        appendFileSync(filePath, append)
        console.log(
            `${chalk.greenBright('✓')} Updated ${HELLO_CONFIG_FILE} with client_id ${chalk.blueBright(client_id)}`,
        )
        return
    } catch (err) {
        if (err.code !== 'ENOENT') {
            // error other than file does not exist
            throw err
        }
    }
    const config = `// ${HELLO_CONFIG_FILE}
// see https://hello.dev/docs/sdks/${name}/#configuration for details

const config = {
    client_id: '${client_id}',
}
module.exports = config
`
    fs.outputFileSync(filePath, config)
    console.log(
        `${chalk.greenBright('✓')} Created ${HELLO_CONFIG_FILE} with client_id ${chalk.blueBright(client_id)}`,
    )
}

const writeEnvLocal = async (name) => {
    const existingSecret = process.env.HELLO_COOKIE_SECRET
    if (existingSecret) {
        console.log(
            `${chalk.yellowBright('⚠')} Skipping - HELLO_COOKIE_SECRET already exists`,
        )
        return
    }

    const secret = randomBytes(32).toString('hex')
    const env = `
# added by @hellocoop/quickstart --${name} on ${new Date().toISOString()}
HELLO_COOKIE_SECRET='${secret}'
`
    const outputFile = process.cwd() + '/' + ENV_FILE
    appendFileSync(outputFile, env)
    console.log(
        `${chalk.greenBright('✓')} Updated ${ENV_FILE} with HELLO_COOKIE_SECRET ${chalk.blueBright(secret)}`,
    )
}

const defaultOptions = {
    integration: 'quickstart-express',
    suffix: 'Express App',
    wildcard_domain: true,
    provider_hint: 'google github gitlab apple-- email--',
}
const express = async (options, name = 'express') => {
    dotenv.config()
    options = { ...defaultOptions, ...options }
    try {
        await writeConfig(options, name)
        await writeEnvLocal(name)
    } catch (e) {
        console.error(e)
        process.exit(1)
    }
}

export default express
