import { describe, expect, it, vi } from 'vitest'
import { hellocoop } from '..'
import { hellocoopClient } from '../client'

describe('hellocoop', () => {
    const clientId = 'hello-client-id'
    const clientSecret = 'hello-client-secret'

    it('should export hellocoop plugin', () => {
        expect(hellocoop).toBeDefined()
        expect(typeof hellocoop).toBe('function')
    })

    it('should export hellocoopClient', () => {
        expect(hellocoopClient).toBeDefined()
        expect(typeof hellocoopClient).toBe('function')
    })

    it('should create hellocoop plugin with config', () => {
        const plugin = hellocoop({
            config: {
                clientId: 'test-client-id',
                clientSecret: 'test-client-secret',
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

    it('should create plugin with HelloCoop-specific configuration options', () => {
        const plugin = hellocoop({
            config: {
                clientId: clientId,
                clientSecret: clientSecret,
                providerHint: 'apple google',
                domainHint: 'example.com',
                loginHint: 'user@example.com',
                callbackURL: '/dashboard',
                errorCallbackURL: '/error',
                disableImplicitSignUp: true,
            },
        })

        expect(plugin).toBeDefined()
        expect(plugin.id).toBe('hellocoop')
        expect(plugin.endpoints).toBeDefined()
        expect(plugin.endpoints.hellocoopSignIn).toBeDefined()
        expect(plugin.endpoints.oAuth2Callback).toBeDefined()
    })

    it('should create plugin with custom getUserInfo function', () => {
        const customGetUserInfo = async () => ({
            id: 'custom-id',
            email: 'custom@test.com',
            name: 'Custom User',
            emailVerified: true,
        })

        const plugin = hellocoop({
            config: {
                clientId: clientId,
                clientSecret: clientSecret,
                getUserInfo: customGetUserInfo,
            },
        })

        expect(plugin).toBeDefined()
        expect(plugin.id).toBe('hellocoop')
    })

    it('should create plugin with custom mapProfileToUser function', () => {
        const customMapProfile = (profile: any) => ({
            id: profile.sub,
            email: profile.email,
            name: `Mapped: ${profile.name}`,
            emailVerified: profile.email_verified,
        })

        const plugin = hellocoop({
            config: {
                clientId: clientId,
                clientSecret: clientSecret,
                mapProfileToUser: customMapProfile,
            },
        })

        expect(plugin).toBeDefined()
        expect(plugin.id).toBe('hellocoop')
    })

    it('should create plugin with authorization headers', () => {
        const customHeaders = {
            'X-Custom-Header': 'test-value',
            Authorization: 'Bearer token',
        }

        const plugin = hellocoop({
            config: {
                clientId: clientId,
                clientSecret: clientSecret,
                authorizationHeaders: customHeaders,
            },
        })

        expect(plugin).toBeDefined()
        expect(plugin.id).toBe('hellocoop')
    })

    it('should create plugin with custom redirect URI', () => {
        const plugin = hellocoop({
            config: {
                clientId: clientId,
                clientSecret: clientSecret,
                redirectURI:
                    'http://localhost:3000/api/auth/callback/hellocoop',
            },
        })

        expect(plugin).toBeDefined()
        expect(plugin.id).toBe('hellocoop')
    })

    it('should create plugin with signup controls', () => {
        const plugin = hellocoop({
            config: {
                clientId: clientId,
                clientSecret: clientSecret,
                disableImplicitSignUp: true,
                disableSignUp: false,
            },
        })

        expect(plugin).toBeDefined()
        expect(plugin.id).toBe('hellocoop')
    })

    it('should create plugin with custom scopes', () => {
        const plugin = hellocoop({
            config: {
                clientId: clientId,
                clientSecret: clientSecret,
                scopes: ['openid', 'profile', 'email', 'custom_scope'],
            },
        })

        expect(plugin).toBeDefined()
        expect(plugin.id).toBe('hellocoop')
    })

    it('should create client plugin with correct action methods', () => {
        const clientPlugin = hellocoopClient()
        const mockFetch = vi.fn()
        const actions = clientPlugin.getActions(mockFetch)

        expect(actions).toBeDefined()
        expect(actions.signInWithHello).toBeDefined()
        expect(typeof actions.signInWithHello).toBe('function')
    })

    it('should handle HelloCoop discovery URL configuration', () => {
        const plugin = hellocoop({
            config: {
                clientId: clientId,
                clientSecret: clientSecret,
                discoveryUrl:
                    'https://issuer.hello.coop/.well-known/openid-configuration',
            },
        })

        expect(plugin).toBeDefined()
        expect(plugin.id).toBe('hellocoop')
    })

    it('should handle custom endpoint URLs', () => {
        const plugin = hellocoop({
            config: {
                clientId: clientId,
                clientSecret: clientSecret,
                authorizationUrl: 'https://issuer.hello.coop/authorize',
                tokenUrl: 'https://issuer.hello.coop/token',
                userInfoUrl: 'https://issuer.hello.coop/userinfo',
            },
        })

        expect(plugin).toBeDefined()
        expect(plugin.id).toBe('hellocoop')
    })

    it('should handle PKCE configuration', () => {
        const plugin = hellocoop({
            config: {
                clientId: clientId,
                clientSecret: clientSecret,
                pkce: true,
            },
        })

        expect(plugin).toBeDefined()
        expect(plugin.id).toBe('hellocoop')
    })

    it('should handle overrideUserInfo configuration', () => {
        const plugin = hellocoop({
            config: {
                clientId: clientId,
                clientSecret: clientSecret,
                overrideUserInfo: true,
            },
        })

        expect(plugin).toBeDefined()
        expect(plugin.id).toBe('hellocoop')
    })

    it('should create plugin with all HelloCoop-specific parameters', () => {
        const plugin = hellocoop({
            config: {
                clientId: clientId,
                clientSecret: clientSecret,
                providerHint: 'apple google microsoft',
                domainHint: 'company.com',
                loginHint: 'user@company.com',
                callbackURL: '/success',
                errorCallbackURL: '/error',
                scopes: ['openid', 'profile', 'email'],
                disableImplicitSignUp: false,
                disableSignUp: false,
                overrideUserInfo: true,
                pkce: true,
                prompt: 'consent',
                accessType: 'offline',
                responseType: 'code',
                responseMode: 'query',
                redirectURI: 'http://localhost:3000/callback',
                authorizationUrl: 'https://issuer.hello.coop/authorize',
                tokenUrl: 'https://issuer.hello.coop/token',
                userInfoUrl: 'https://issuer.hello.coop/userinfo',
                discoveryUrl:
                    'https://issuer.hello.coop/.well-known/openid-configuration',
                authorizationHeaders: { 'X-Custom': 'header' },
                discoveryHeaders: { 'X-Discovery': 'header' },
            },
        })

        expect(plugin).toBeDefined()
        expect(plugin.id).toBe('hellocoop')
        expect(plugin.endpoints).toBeDefined()
        expect(plugin.endpoints.hellocoopSignIn).toBeDefined()
        expect(plugin.endpoints.oAuth2Callback).toBeDefined()
    })
})
