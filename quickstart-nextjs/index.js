import 'dotenv/config'
import * as fs from 'fs'
import { randomBytes } from 'crypto'
import quickstart from '@hellocoop/quickstart'

const qs = async function () {
    if (!process.stdout.isTTY) {
        const error = new Error(
            'Not running on interactive terminal. Exiting Hellō Quickstart for Next.js',
        )
        console.error(error)
        return error
    }

    console.log('Hellō Quickstart for Next.js ... \n')

    let helloConfig = `
# added by @hellocoop/quickstart-nextjs on ${new Date().toISOString()}`

    let client_id = null
    const existingClientId = process.env.HELLO_CLIENT_ID
    if (existingClientId) {
        console.log(`HELLO_CLIENT_ID already set to ${existingClientId}`)
    } else {
        try {
            client_id = await quickstart({
                suffix: 'Next.js Application',
                integration: 'quickstart-nextjs',
                wildcard_domain: true,
                provider_hint: 'github gitlab email-- apple--',
            })
        } catch (err) {
            return err
        }
        helloConfig += `
HELLO_CLIENT_ID='${client_id}'`
    }

    let session_secret = null
    const existingSessionSecret = process.env.HELLO_COOKIE_SECRET
    if (existingSessionSecret) {
        console.log(
            `HELLO_COOKIE_SECRET already set to ${existingSessionSecret}`,
        )
    } else {
        session_secret = randomBytes(32).toString('hex')
        helloConfig += `
HELLO_COOKIE_SECRET='${session_secret}'`
    }

    if (client_id || session_secret) {
        const envFile = process.cwd() + '/.env'

        try {
            const err = fs.appendFileSync(envFile, helloConfig)
        } catch (err) {
            console.err(err)
            return err
        }
        console.log(`\nUpdated ${envFile} with:`)
        console.log(helloConfig + '\n')
    } else {
        console.log('No updates made.\n')
    }
}

export default qs
