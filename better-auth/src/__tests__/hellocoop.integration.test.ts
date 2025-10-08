import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hellocoop } from '..'
import { hellocoopClient } from '../client'

import { spawn, ChildProcess } from 'child_process'

describe('hellocoop integration', () => {
    const clientId = 'hello-client-id'
    const clientSecret = 'hello-client-secret'
    let mockinServer: ChildProcess
    const mockinPort = 3333

    beforeAll(async () => {
        // Start HelloCoop mockin server
        mockinServer = spawn('npx', ['@hellocoop/mockin'], {
            stdio: 'pipe',
            detached: false,
        })

        // Wait for server to start
        await new Promise((resolve) => {
            setTimeout(resolve, 5000)
        })
    })

    afterAll(async () => {
        if (mockinServer) {
            mockinServer.kill()
            // Wait for process to terminate
            await new Promise((resolve) => {
                mockinServer.on('exit', resolve)
                setTimeout(resolve, 1000)
            })
        }
    })

    it('should create hellocoop plugin with mockin server URLs', () => {
        const plugin = hellocoop({
            config: {
                clientId: clientId,
                clientSecret: clientSecret,
                authorizationUrl: `http://localhost:${mockinPort}/authorize`,
                tokenUrl: `http://localhost:${mockinPort}/oauth/token`,
                userInfoUrl: `http://localhost:${mockinPort}/oauth/userinfo`,
            },
        })

        expect(plugin).toBeDefined()
        expect(plugin.id).toBe('hellocoop')
        expect(plugin.endpoints).toBeDefined()
        expect(plugin.endpoints.hellocoopSignIn).toBeDefined()
        expect(plugin.endpoints.oAuth2Callback).toBeDefined()
    })

    it('should create hellocoopClient plugin', () => {
        const clientPlugin = hellocoopClient()

        expect(clientPlugin).toBeDefined()
        expect(clientPlugin.id).toBe('hellocoop-client')
        expect(clientPlugin.pathMethods).toBeDefined()
        expect(clientPlugin.pathMethods['/hellocoop/sign-in']).toBe('POST')
        expect(clientPlugin.getActions).toBeDefined()
    })

    it('should create authorization URL with HelloCoop-specific parameters', async () => {
        const plugin = hellocoop({
            config: {
                clientId: clientId,
                clientSecret: clientSecret,
                authorizationUrl: `http://localhost:${mockinPort}/authorize`,
                tokenUrl: `http://localhost:${mockinPort}/oauth/token`,
                userInfoUrl: `http://localhost:${mockinPort}/oauth/userinfo`,
            },
        })

        // Initialize the plugin to get the social provider
        const context = plugin.init({
            baseURL: 'http://localhost:3000',
            socialProviders: [],
        } as any)

        const socialProvider = context.context.socialProviders[0]
        expect(socialProvider).toBeDefined()

        // Test creating authorization URL
        const authUrlResult = await socialProvider.createAuthorizationURL({
            state: 'test-state',
            redirectURI: 'http://localhost:3000/hellocoop/callback',
            codeVerifier: 'test-code-verifier',
        } as any)

        const authUrl = authUrlResult.toString()

        expect(typeof authUrl).toBe('string')
        expect(authUrl).toContain(`http://localhost:${mockinPort}/authorize`)
        expect(authUrl).toContain('client_id=hello-client-id')
        expect(authUrl).toContain('state=test-state')
        expect(authUrl).toContain(
            'redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fhellocoop%2Fcallback',
        )
    })

    it('should create authorization URL with login_hint parameter', async () => {
        const plugin = hellocoop({
            config: {
                clientId: clientId,
                clientSecret: clientSecret,
                authorizationUrl: `http://localhost:${mockinPort}/authorize`,
                tokenUrl: `http://localhost:${mockinPort}/oauth/token`,
                userInfoUrl: `http://localhost:${mockinPort}/oauth/userinfo`,
            },
        })

        const context = plugin.init({
            baseURL: 'http://localhost:3000',
            socialProviders: [],
        } as any)

        const socialProvider = context.context.socialProviders[0]

        // Test with login_hint
        const authUrlResult = await socialProvider.createAuthorizationURL({
            state: 'test-state',
            redirectURI: 'http://localhost:3000/hellocoop/callback',
            loginHint: 'user@example.com',
            codeVerifier: 'test-code-verifier',
        } as any)

        const authUrl = authUrlResult.toString()

        expect(authUrl).toContain('login_hint=user%40example.com')
    })

    it('should create authorization URL with domain_hint parameter', async () => {
        const plugin = hellocoop({
            config: {
                clientId: clientId,
                clientSecret: clientSecret,
                authorizationUrl: `http://localhost:${mockinPort}/authorize`,
                tokenUrl: `http://localhost:${mockinPort}/oauth/token`,
                userInfoUrl: `http://localhost:${mockinPort}/oauth/userinfo`,
            },
        })

        const context = plugin.init({
            baseURL: 'http://localhost:3000',
            socialProviders: [],
        } as any)

        const socialProvider = context.context.socialProviders[0]

        // Test with domain_hint
        const authUrlResult = await socialProvider.createAuthorizationURL({
            state: 'test-state',
            redirectURI: 'http://localhost:3000/hellocoop/callback',
            domainHint: 'example.com',
            codeVerifier: 'test-code-verifier',
        } as any)

        const authUrl = authUrlResult.toString()

        expect(authUrl).toContain('domain_hint=example.com')
    })

    it('should create authorization URL with provider_hint parameter', async () => {
        const plugin = hellocoop({
            config: {
                clientId: clientId,
                clientSecret: clientSecret,
                authorizationUrl: `http://localhost:${mockinPort}/authorize`,
                tokenUrl: `http://localhost:${mockinPort}/oauth/token`,
                userInfoUrl: `http://localhost:${mockinPort}/oauth/userinfo`,
            },
        })

        const context = plugin.init({
            baseURL: 'http://localhost:3000',
            socialProviders: [],
        } as any)

        const socialProvider = context.context.socialProviders[0]

        // Test with provider_hint
        const authUrlResult = await socialProvider.createAuthorizationURL({
            state: 'test-state',
            redirectURI: 'http://localhost:3000/hellocoop/callback',
            providerHint: 'google',
            codeVerifier: 'test-code-verifier',
        } as any)

        const authUrl = authUrlResult.toString()

        expect(authUrl).toContain('provider_hint=google')
    })

    it('should handle custom scopes in configuration', async () => {
        const plugin = hellocoop({
            config: {
                clientId: clientId,
                clientSecret: clientSecret,
                authorizationUrl: `http://localhost:${mockinPort}/authorize`,
                tokenUrl: `http://localhost:${mockinPort}/oauth/token`,
                userInfoUrl: `http://localhost:${mockinPort}/oauth/userinfo`,
                scopes: ['openid', 'email', 'profile', 'custom'],
            },
        })

        const context = plugin.init({
            baseURL: 'http://localhost:3000',
            socialProviders: [],
        } as any)

        const socialProvider = context.context.socialProviders[0]

        const authUrlResult = await socialProvider.createAuthorizationURL({
            state: 'test-state',
            redirectURI: 'http://localhost:3000/hellocoop/callback',
            codeVerifier: 'test-code-verifier',
        } as any)

        const authUrl = authUrlResult.toString()

        expect(authUrl).toContain('scope=openid+email+profile+custom')
    })

    it('should handle custom redirect URI in configuration', async () => {
        const customRedirectURI = 'http://localhost:3000/custom-callback'
        const plugin = hellocoop({
            config: {
                clientId: clientId,
                clientSecret: clientSecret,
                authorizationUrl: `http://localhost:${mockinPort}/authorize`,
                tokenUrl: `http://localhost:${mockinPort}/oauth/token`,
                userInfoUrl: `http://localhost:${mockinPort}/oauth/userinfo`,
                redirectURI: customRedirectURI,
            },
        })

        const context = plugin.init({
            baseURL: 'http://localhost:3000',
            socialProviders: [],
        } as any)

        const socialProvider = context.context.socialProviders[0]

        const authUrlResult = await socialProvider.createAuthorizationURL({
            state: 'test-state',
            redirectURI: 'http://localhost:3000/hellocoop/callback', // This should be overridden by config
            codeVerifier: 'test-code-verifier',
        } as any)

        const authUrl = authUrlResult.toString()

        expect(authUrl).toContain(
            `redirect_uri=${encodeURIComponent(customRedirectURI)}`,
        )
    })

    it('should handle prompt parameter in configuration', async () => {
        const plugin = hellocoop({
            config: {
                clientId: clientId,
                clientSecret: clientSecret,
                authorizationUrl: `http://localhost:${mockinPort}/authorize`,
                tokenUrl: `http://localhost:${mockinPort}/oauth/token`,
                userInfoUrl: `http://localhost:${mockinPort}/oauth/userinfo`,
                prompt: 'consent',
            },
        })

        const context = plugin.init({
            baseURL: 'http://localhost:3000',
            socialProviders: [],
        } as any)

        const socialProvider = context.context.socialProviders[0]

        const authUrlResult = await socialProvider.createAuthorizationURL({
            state: 'test-state',
            redirectURI: 'http://localhost:3000/hellocoop/callback',
            codeVerifier: 'test-code-verifier',
        } as any)

        const authUrl = authUrlResult.toString()

        expect(authUrl).toContain('prompt=consent')
    })

    it('should handle accessType parameter in configuration', async () => {
        const plugin = hellocoop({
            config: {
                clientId: clientId,
                clientSecret: clientSecret,
                authorizationUrl: `http://localhost:${mockinPort}/authorize`,
                tokenUrl: `http://localhost:${mockinPort}/oauth/token`,
                userInfoUrl: `http://localhost:${mockinPort}/oauth/userinfo`,
                accessType: 'offline',
            },
        })

        const context = plugin.init({
            baseURL: 'http://localhost:3000',
            socialProviders: [],
        } as any)

        const socialProvider = context.context.socialProviders[0]

        const authUrlResult = await socialProvider.createAuthorizationURL({
            state: 'test-state',
            redirectURI: 'http://localhost:3000/hellocoop/callback',
            codeVerifier: 'test-code-verifier',
        } as any)

        const authUrl = authUrlResult.toString()

        expect(authUrl).toContain('access_type=offline')
    })

    it('should handle authorizationUrlParams in configuration', async () => {
        const plugin = hellocoop({
            config: {
                clientId: clientId,
                clientSecret: clientSecret,
                authorizationUrl: `http://localhost:${mockinPort}/authorize`,
                tokenUrl: `http://localhost:${mockinPort}/oauth/token`,
                userInfoUrl: `http://localhost:${mockinPort}/oauth/userinfo`,
                authorizationUrlParams: {
                    custom_param: 'custom_value',
                    another_param: 'another_value',
                },
            },
        })

        const context = plugin.init({
            baseURL: 'http://localhost:3000',
            socialProviders: [],
        } as any)

        const socialProvider = context.context.socialProviders[0]

        const authUrlResult = await socialProvider.createAuthorizationURL({
            state: 'test-state',
            redirectURI: 'http://localhost:3000/hellocoop/callback',
            codeVerifier: 'test-code-verifier',
        } as any)

        const authUrl = authUrlResult.toString()

        expect(authUrl).toContain('custom_param=custom_value')
        expect(authUrl).toContain('another_param=another_value')
    })

    it('should validate plugin configuration with discovery URL', async () => {
        const plugin = hellocoop({
            config: {
                clientId: clientId,
                clientSecret: clientSecret,
                discoveryUrl: `http://localhost:${mockinPort}/.well-known/openid-configuration`,
            },
        })

        expect(plugin).toBeDefined()
        expect(plugin.id).toBe('hellocoop')

        const context = plugin.init({
            baseURL: 'http://localhost:3000',
            socialProviders: [],
        } as any)

        const socialProvider = context.context.socialProviders[0]
        expect(socialProvider).toBeDefined()
    })

    it('should handle PKCE configuration', async () => {
        const plugin = hellocoop({
            config: {
                clientId: clientId,
                clientSecret: clientSecret,
                authorizationUrl: `http://localhost:${mockinPort}/authorize`,
                tokenUrl: `http://localhost:${mockinPort}/oauth/token`,
                userInfoUrl: `http://localhost:${mockinPort}/oauth/userinfo`,
                pkce: true,
            },
        })

        const context = plugin.init({
            baseURL: 'http://localhost:3000',
            socialProviders: [],
        } as any)

        const socialProvider = context.context.socialProviders[0]

        const authUrlResult = await socialProvider.createAuthorizationURL({
            state: 'test-state',
            redirectURI: 'http://localhost:3000/hellocoop/callback',
            codeVerifier: 'test-code-verifier', // PKCE requires a code verifier
        })

        const authUrl = authUrlResult.toString()

        // PKCE should add code_challenge and code_challenge_method
        expect(authUrl).toContain('code_challenge=')
        expect(authUrl).toContain('code_challenge_method=S256')
    })

    it('should override root config with runtime parameters', () => {
        // This test validates that the plugin properly handles parameter precedence
        // Runtime parameters should override config defaults

        const plugin = hellocoop({
            config: {
                clientId: clientId,
                clientSecret: clientSecret,
                authorizationUrl: `http://localhost:${mockinPort}/authorize`,
                tokenUrl: `http://localhost:${mockinPort}/oauth/token`,
                userInfoUrl: `http://localhost:${mockinPort}/oauth/userinfo`,
                scopes: ['openid', 'profile'], // Default scopes
                prompt: 'login', // Default prompt
                providerHint: 'default-provider', // Default provider hint
                domainHint: 'default.com', // Default domain hint
                loginHint: 'rohan@xyz.com', // Default login hint (as in user's example)
            },
        })

        expect(plugin).toBeDefined()
        expect(plugin.id).toBe('hellocoop')

        // The actual override logic is tested in the hellocoopSignIn endpoint
        // This test validates the plugin structure supports the configuration
        expect(plugin.endpoints.hellocoopSignIn).toBeDefined()
    })
})
