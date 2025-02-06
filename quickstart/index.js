import open from 'open'
import getPort from 'get-port'
import readline from 'readline'
import * as http from 'http'
import { URLSearchParams, parse } from 'url'
import page from './page.js'
import chalk from 'chalk'

export const validQuickstartParams = [
    'suffix',
    'name',
    'tos_uri',
    'pp_uri',
    'image_uri',
    'dark_image_uri',
    'redirect_uri',
    'integration',
    'wildcard_domain',
    'provider_hint',
]

const quickstart = async function (params) {
    return new Promise((resolve, reject) => {
        async function startServer() {
            if (!process.stdout.isTTY) {
                const error = new Error(
                    'Not running on interactive terminal. Exiting Quickstart CLI',
                )
                console.error(error)
                return reject(error)
            }

            const paramKeys = Object.keys(params || {})
            if (paramKeys) {
                paramKeys.forEach((param) => {
                    if (!validQuickstartParams.includes(param)) {
                        reject(new Error(`Invalid param:${param}`))
                        return
                    }
                    if (!params[param]) delete params[param]
                })
            }

            const port = await getPort()
            const host = 'localhost'

            const server = http.createServer((req, res) => {
                const u = parse(req.url, true)
                if (u.pathname !== '/') {
                    res.writeHead(200)
                    return res.end('ok')
                }
                res.writeHead(200)

                const clientHTML = page(u.query.client_id)
                res.end(clientHTML, () => {
                    server.closeAllConnections()
                    server.close(() => {
                        resolve(u.query.client_id)
                    })
                })
            })

            const response_uri = `http://${host}:${port}/`
            const queryParams = {
                ...params,
                response_uri,
            }
            const queryString = new URLSearchParams(queryParams).toString()
            const helloDomain = process.env.HELLO_DOMAIN || 'hello.coop'
            const quickstartURL = `https://quickstart.${helloDomain}/?${queryString}`
            server.listen(port, host, () => {
                console.log('Obtaining a Hellō client_id with:')
                console.log(chalk.blueBright(quickstartURL))

                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout,
                })

                rl.question('Press ENTER to open in the browser...', () => {
                    open(quickstartURL)
                    rl.close()
                })
            })
        }

        startServer().catch(reject)
    })
}

export default quickstart
