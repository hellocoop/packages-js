const APP_HOME = 'http://127.0.0.1:3000/'
const MOCKIN = 'http://127.0.0.1:3333/'
const APP_API = APP_HOME + 'api/hellocoop'

import { test, expect } from '@playwright/test'
import config from '../app/hello.config'

const loggedOut = { isLoggedIn: false }
const loggedIn = {
    isLoggedIn: true,
    sub: '00000000-0000-0000-0000-00000000',
    name: 'John Smith',
    email: 'john.smith@example.com',
    picture: 'https://pictures.hello.coop/mock/portrait-of-john-smith.jpeg',
    email_verified: true,
}
const usrDanBrown = {
    isLoggedIn: true,
    sub: 'sub_wdfp66OC0Me43YW9q6sisnP6_h2q',
    name: 'Dan Brown',
    email: 'dan.brown@example.net',
    picture: 'https://pictures.hello.coop/mock/john-smith-facebook.jpeg',
    email_verified: true,
}
const usrLewisCarroll = {
    isLoggedIn: true,
    sub: 'sub_PrHrJvaaszcdyltTt52v3UcH_dbf',
    name: 'Lewis Carroll',
    picture: 'https://pictures.hello.coop/mock/john-smith-yahoo.jpeg',
    email: 'lewis.carroll@example.org',
    email_verified: true,
}

/* 
* used for debugging
*
const trace = (page) => {
    page.on('request', async request => {
        console.log('Request:', request.method(), request.url());
        console.log('\theaders:', request.headers());
      });
      
    page.on('response', async response => {
        console.log('Response:', response.status(), response.url());
        console.log('\tresponse headers:', response.headers());
    });
    
    page.on('requestfailed', request => {
        console.log('Request failed:', request.method(), request.url(), request?.failure()?.errorText);
        console.log('\theaders:', request.headers());
    });
}
*/

test.describe(`Testing ${APP_HOME}`, () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(APP_API + '?op=logout')
    })
    test('logged out', async ({ page }) => {
        await page.goto(APP_HOME)
        const body = await page.textContent('body')
        try {
            const json = JSON.parse(body as string)
            delete json.iat
            expect(json).toEqual(loggedOut)
        } catch (e) {
            expect(e).toBeNull()
        }
    })
    test('logged in', async ({ page }) => {
        await page.goto(APP_API + '?op=login')
        const body = await page.textContent('body')
        try {
            const json = JSON.parse(body as string)
            delete json.iat
            expect(json).toEqual(loggedIn)
        } catch (e) {
            expect(e).toBeNull()
        }
    })
    test('auth', async ({ page }) => {
        // log in first
        await page.goto(APP_API + '?op=login')

        // check auth
        await page.goto(APP_API + '?op=auth')
        const body = await page.textContent('body')
        try {
            const json = JSON.parse(body as string)
            delete json.iat
            expect(json).toEqual(loggedIn)
        } catch (e) {
            expect(e).toBeNull()
        }
    })
    test('IdP initiated login w/ GET login_hint', async ({ page }) => {
        const data = new URLSearchParams({
            op: 'login',
            login_hint: 'dan.brown@example.net',
        })
        await page.goto(APP_API + '?' + data.toString())
        const body = await page.textContent('body')
        expect(body).toBeDefined
        const json = JSON.parse(body as string)
        expect(json).toBeDefined
        delete json.iat
        expect(json).toEqual(usrDanBrown)
    })
    test('IdP initiated login w/ POST login_hint', async ({ page }) => {
        const data = new URLSearchParams({
            op: 'login',
            login_hint: 'dan.brown@example.net',
        })
        await page.goto(APP_HOME + 'post-test?' + data.toString())
        const body = await page.textContent('body')
        expect(body).toBeDefined
        const json = JSON.parse(body as string)
        expect(json).toBeDefined
        delete json.iat
        expect(json).toEqual(usrDanBrown)
    })
    test('IdP initiated login w/ GET login_hint & iss', async ({ page }) => {
        const data = new URLSearchParams({
            op: 'login',
            login_hint: 'dan.brown@example.net',
            iss: 'https://issuer.hello.coop',
        })
        await page.goto(APP_API + '?' + data.toString())
        const body = await page.textContent('body')
        expect(body).toBeDefined
        const json = JSON.parse(body as string)
        expect(json).toBeDefined
        delete json.iat
        expect(json).toEqual(usrDanBrown)
    })
    test('IdP initiated login w/ POST login_hint & iss', async ({ page }) => {
        const data = new URLSearchParams({
            op: 'login',
            login_hint: 'dan.brown@example.net',
            iss: 'https://issuer.hello.coop',
        })
        await page.goto(APP_HOME + 'post-test?' + data.toString())
        const body = await page.textContent('body')
        expect(body).toBeDefined
        const json = JSON.parse(body as string)
        expect(json).toBeDefined
        delete json.iat
        expect(json).toEqual(usrDanBrown)
    })
    test('IdP initiated login w/ GET login_hint & domain_hint', async ({
        page,
    }) => {
        const data = new URLSearchParams({
            op: 'login',
            login_hint: 'dan.brown@example.net',
            domain_hint: 'example.net',
        })
        await page.goto(APP_API + '?' + data.toString())
        const body = await page.textContent('body')
        expect(body).toBeDefined
        const json = JSON.parse(body as string)
        expect(json).toBeDefined
        delete json.iat
        expect(json).toEqual(usrDanBrown)
    })
    test('domain_hint', async ({ page }) => {
        const data = new URLSearchParams({
            op: 'login',
            domain_hint: 'example.org',
        })
        await page.goto(APP_API + '?' + data.toString())
        const body = await page.textContent('body')
        expect(body).toBeDefined
        const json = JSON.parse(body as string)
        expect(json).toBeDefined
        delete json.iat
        expect(json).toEqual(usrLewisCarroll)
    })
    test('IdP initiated login w/ GET domain_hint', async ({ page }) => {
        const data = new URLSearchParams({
            domain_hint: 'example.org',
        })
        await page.goto(APP_API + '?' + data.toString())
        const body = await page.textContent('body')
        expect(body).toBeDefined
        const json = JSON.parse(body as string)
        expect(json).toBeDefined
        delete json.iat
        expect(json).toEqual(usrLewisCarroll)
    })
    test('IdP initiated login w/ POST domain_hint', async ({ page }) => {
        const data = new URLSearchParams({
            op: 'login',
            domain_hint: 'example.org',
        })
        await page.goto(APP_HOME + 'post-test?' + data.toString())
        const body = await page.textContent('body')
        expect(body).toBeDefined
        const json = JSON.parse(body as string)
        expect(json).toBeDefined
        delete json.iat
        expect(json).toEqual(usrLewisCarroll)
    })
    test('IdP initiated login w/ GET domain_hint & iss', async ({ page }) => {
        const data = new URLSearchParams({
            op: 'login',
            domain_hint: 'example.org',
            iss: 'https://issuer.hello.coop',
        })
        await page.goto(APP_API + '?' + data.toString())
        const body = await page.textContent('body')
        expect(body).toBeDefined
        const json = JSON.parse(body as string)
        expect(json).toBeDefined
        delete json.iat
        expect(json).toEqual(usrLewisCarroll)
    })
    test('IdP initiated login w/ POST domain_hint & iss', async ({ page }) => {
        const data = new URLSearchParams({
            op: 'login',
            domain_hint: 'example.org',
            iss: 'https://issuer.hello.coop',
        })
        await page.goto(APP_HOME + 'post-test?' + data.toString())
        const body = await page.textContent('body')
        expect(body).toBeDefined
        const json = JSON.parse(body as string)
        expect(json).toBeDefined
        delete json.iat
        expect(json).toEqual(usrLewisCarroll)
    })
    test('invite', async ({ page }) => {
        // log in first
        await page.goto(APP_API + '?op=login')

        // invite
        const appName = 'Test'
        const data = new URLSearchParams({
            op: 'invite',
            app_name: appName,
        })
        await page.goto(APP_API + '?' + data.toString())
        const url = page.url()
        const inviteReqUrl = new URL(url)
        const inviteReqUrlParams = new URLSearchParams(inviteReqUrl.search)
        const inviter = inviteReqUrlParams.get('inviter')
        expect(inviter).toEqual(loggedIn.sub)
        const client_id = inviteReqUrlParams.get('client_id')
        expect(client_id).toEqual(config.client_id)
        const initiate_login_uri = inviteReqUrlParams.get('initiate_login_uri')
        expect(initiate_login_uri).toEqual(APP_API)
        const app_name = inviteReqUrlParams.get('app_name')
        expect(app_name).toEqual(appName)
        const prompt = inviteReqUrlParams.get('prompt')
        expect(prompt).toEqual(
            `${loggedIn.name} has invited you to join ${appName}`,
        )
        const return_uri = inviteReqUrlParams.get('return_uri')
        expect(return_uri).toEqual(APP_HOME)
    })
    test('should get metadata', async ({ page }) => {
        const commandTokenRes = await page.request.get(
            MOCKIN + 'command/mock?client_id=' + config.client_id,
        )
        const { command_token } = await commandTokenRes.json()
        expect(command_token).toBeDefined
        const data = new URLSearchParams({ command_token })
        await page.goto(APP_HOME + 'post-test?' + data.toString())
        const body = await page.textContent('body')
        expect(body).toBeDefined
        const metadata = JSON.parse(body as string)
        expect(metadata).toBeDefined
        expect(metadata.context).toBeDefined()
        // expect(metadata.context.package_name).toBe();
        expect(metadata.context.package_version).toBeDefined()
        // expect(metadata.context.package_version).toBe('0.0.1');
        expect(metadata.context.iss).toBeDefined()
        expect(metadata.commands_uri).toBeDefined()
        expect(metadata.commands_supported).toBeDefined()
        expect(metadata.commands_supported).toEqual(['metadata'])
        expect(metadata.commands_ttl).toBeDefined()
        expect(metadata.commands_ttl).toEqual(0)
        expect(metadata.client_id).toBeDefined()
        expect(metadata.client_id).toEqual(config.client_id)
    })

    test('loginURL - should return OAuth URL and state, and then exchange code for access_token and auth', async ({
        page,
    }) => {
        // Add redirect_uri parameter for mobile apps
        const response = await page.request.get(
            APP_API + '?op=loginURL&redirect_uri=' + encodeURIComponent(MOCKIN),
        )

        // Debug: log the actual response
        if (response.status() !== 200) {
            const errorBody = await response.text()
            console.log(
                'loginURL error response:',
                response.status(),
                errorBody,
            )
        }

        expect(response.status()).toBe(200)

        const body = await response.json()
        expect(body).toBeDefined()
        expect(body.url).toBeDefined()
        expect(body.state).toBeDefined()
        expect(typeof body.url).toBe('string')
        expect(typeof body.state).toBe('string')

        // URL should be a valid Hellō OAuth URL (using MOCKIN for testing)
        expect(body.url.startsWith(MOCKIN)).toBe(true)

        // State should be an encrypted string (base64-like)
        expect(body.state.length).toBeGreaterThan(50)

        // load the URL in the browser
        await page.goto(body.url)

        // extract code
        const url = new URL(page.url())
        const code = url.searchParams.get('code') as string
        expect(code).toBeDefined()

        // Simulate the OAuth flow by exchanging the code
        const exchangeResponse = await page.request.get(
            APP_API +
            '?op=exchange&code=' +
            encodeURIComponent(code) +
            '&state=' +
            encodeURIComponent(body.state),
        )
        expect(exchangeResponse.status()).toBe(200)

        const exchangeBody = await exchangeResponse.json()

        // Log response details for debugging
        if (exchangeResponse.status() !== 200) {
            console.log(
                'Exchange failed with status:',
                exchangeResponse.status(),
            )
            console.log('Exchange error body:', exchangeBody)
        }

        expect(exchangeBody.access_token).toBeDefined()
        expect(exchangeBody.auth).toBeDefined()
        expect(exchangeBody.auth.isLoggedIn).toBe(true)
        expect(exchangeBody.auth.sub).toBeDefined()
    })

    test('loginURL with parameters - should handle scope and provider_hint', async ({
        page,
    }) => {
        const params = new URLSearchParams({
            op: 'loginURL',
            scope: 'openid name email',
            provider_hint: 'github',
            login_hint: 'dan.brown@example.net',
            redirect_uri: MOCKIN,
        })

        const response = await page.request.get(
            APP_API + '?' + params.toString(),
        )

        // Debug: log the actual response if there's an error
        if (response.status() !== 200) {
            const errorBody = await response.text()
            console.log(
                'loginURL with parameters error response:',
                response.status(),
                errorBody,
            )
        }

        expect(response.status()).toBe(200)

        const body = await response.json()
        expect(body.url).toBeDefined()
        expect(body.state).toBeDefined()

        // URL should contain the parameters
        const url = new URL(body.url)
        expect(url.searchParams.get('scope')).toBe('openid name email')
        expect(url.searchParams.get('provider_hint')).toBe('github')
        expect(url.searchParams.get('login_hint')).toBe('dan.brown@example.net')

        // load the URL in the browser
        await page.goto(body.url)

        // extract code
        const responseURL = new URL(page.url())
        const code = responseURL.searchParams.get('code') as string
        expect(code).toBeDefined()

        // Simulate the OAuth flow by exchanging the code
        const exchangeResponse = await page.request.get(
            APP_API +
            '?op=exchange&code=' +
            encodeURIComponent(code) +
            '&state=' +
            encodeURIComponent(body.state),
        )
        expect(exchangeResponse.status()).toBe(200)

        const exchangeBody = await exchangeResponse.json()
        expect(exchangeBody.access_token).toBeDefined()
        expect(exchangeBody.auth).toBeDefined()
        expect(exchangeBody.auth.isLoggedIn).toBe(true)
        expect(exchangeBody.auth.sub).toBeDefined()
    })

    test('domain_hint with default scope - should use default scope when scope not provided', async ({
        page,
    }) => {
        const data = new URLSearchParams({
            op: 'loginURL',
            domain_hint: 'example.org',
            redirect_uri: MOCKIN,
        })

        const response = await page.request.get(APP_API + '?' + data.toString())

        expect(response.status()).toBe(200)

        const body = await response.json()
        expect(body.url).toBeDefined()
        expect(body.state).toBeDefined()

        // URL should contain domain_hint and default scope
        const url = new URL(body.url)
        expect(url.searchParams.get('domain_hint')).toBe('example.org')
        // Default scope should be 'openid name email picture'
        const scope = url.searchParams.get('scope')
        expect(scope).toBeDefined()
        const scopes = scope?.split(' ') || []
        expect(scopes).toContain('openid')
        expect(scopes).toContain('name')
        expect(scopes).toContain('email')
        expect(scopes).toContain('picture')
    })

    test('domain_hint flow with default scope in login redirect', async ({
        page,
    }) => {
        const data = new URLSearchParams({
            op: 'login',
            domain_hint: 'example.org',
        })

        // Intercept the redirect to get the authorization URL
        let authUrl: string | null = null
        page.on('response', (response) => {
            const status = response.status()
            if (status >= 300 && status < 400) {
                const location = response.headers()['location']
                // Capture the redirect to the authorization server (MOCKIN)
                if (location && location.startsWith(MOCKIN)) {
                    authUrl = location
                }
            }
        })

        // Make the request - it will redirect
        await page.goto(APP_API + '?' + data.toString(), {
            waitUntil: 'domcontentloaded',
        })

        // Check that we captured the authorization URL
        expect(authUrl).toBeDefined()
        expect(authUrl).not.toBeNull()
        if (!authUrl) {
            throw new Error('Authorization URL was not captured')
        }

        // Parse the authorization URL
        const url = new URL(authUrl)

        // Check that domain_hint is in the URL
        expect(url.searchParams.get('domain_hint')).toBe('example.org')

        // Check that default scope is present
        const scope = url.searchParams.get('scope')
        expect(scope).toBeDefined()
        const scopes = scope?.split(' ') || []
        expect(scopes).toContain('openid')
        expect(scopes).toContain('name')
        expect(scopes).toContain('email')
        expect(scopes).toContain('picture')
    })

    test('loginURL with explicit scope - Priority 1: inline scopes override defaults', async ({
        page,
    }) => {
        // Priority order: 1. inline scopes > 2. environment scopes > 3. default scopes
        // This test verifies priority 1: inline scope parameter overrides default scopes
        const params = new URLSearchParams({
            op: 'loginURL',
            scope: 'openid name',
            redirect_uri: MOCKIN,
        })

        const response = await page.request.get(
            APP_API + '?' + params.toString(),
        )

        expect(response.status()).toBe(200)

        const body = await response.json()
        expect(body.url).toBeDefined()
        expect(body.state).toBeDefined()

        // URL should contain the explicitly provided scope
        const url = new URL(body.url)
        const scope = url.searchParams.get('scope')
        expect(scope).toBeDefined()
        const scopes = scope?.split(' ') || []
        // Should contain the explicitly provided scopes (priority 1)
        expect(scopes).toContain('openid')
        expect(scopes).toContain('name')
        // Should not contain other default scopes when explicitly overridden
        expect(scopes).not.toContain('email')
        expect(scopes).not.toContain('picture')
    })

    test('loginURL with explicit scope in login redirect - Priority 1: inline scopes override defaults', async ({
        page,
    }) => {
        // Priority order: 1. inline scopes > 2. environment scopes > 3. default scopes
        // This test verifies priority 1: inline scope parameter overrides default scopes in redirect flow
        const data = new URLSearchParams({
            op: 'login',
            scope: 'openid email picture',
        })

        // Intercept the redirect to get the authorization URL
        let authUrl: string | null = null
        page.on('response', (response) => {
            const status = response.status()
            if (status >= 300 && status < 400) {
                const location = response.headers()['location']
                // Capture the redirect to the authorization server (MOCKIN)
                if (location && location.startsWith(MOCKIN)) {
                    authUrl = location
                }
            }
        })

        // Make the request - it will redirect
        await page.goto(APP_API + '?' + data.toString(), {
            waitUntil: 'domcontentloaded',
        })

        // Check that we captured the authorization URL
        expect(authUrl).toBeDefined()
        expect(authUrl).not.toBeNull()
        if (!authUrl) {
            throw new Error('Authorization URL was not captured')
        }

        // Parse the authorization URL
        const url = new URL(authUrl)

        // Check that explicit scope is present
        const scope = url.searchParams.get('scope')
        expect(scope).toBeDefined()
        const scopes = scope?.split(' ') || []
        // Should contain the explicitly provided scopes
        expect(scopes).toContain('openid')
        expect(scopes).toContain('email')
        expect(scopes).toContain('picture')
        // Should not contain name when not explicitly requested
        expect(scopes).not.toContain('name')
    })

    test('loginURL without scope parameter - Priority 3: uses default scopes when no inline or environment scopes', async ({
        page,
    }) => {
        // Priority order: 1. inline scopes > 2. environment scopes > 3. default scopes
        // This test verifies priority 3: default scopes are used when no inline scope and no HELLO_SCOPES env var
        const params = new URLSearchParams({
            op: 'loginURL',
            redirect_uri: MOCKIN,
        })

        const response = await page.request.get(
            APP_API + '?' + params.toString(),
        )

        expect(response.status()).toBe(200)

        const body = await response.json()
        expect(body.url).toBeDefined()
        expect(body.state).toBeDefined()

        // URL should contain default scope (priority 3)
        const url = new URL(body.url)
        const scope = url.searchParams.get('scope')
        expect(scope).toBeDefined()
        const scopes = scope?.split(' ') || []
        // Should contain default scopes
        expect(scopes).toContain('openid')
        expect(scopes).toContain('name')
        expect(scopes).toContain('email')
        expect(scopes).toContain('picture')
    })
})
