import { describe, it, expect } from 'vitest'
import { buildHelloAuthURL } from '../client'

describe('buildHelloAuthURL', () => {
    const baseParams = {
        clientId: 'test-client-id',
        redirectUri: 'http://localhost:3000/callback',
    }

    it('should build basic auth URL with default scopes', () => {
        const url = buildHelloAuthURL(baseParams)

        expect(url).toContain('https://wallet.hello.coop/authorize?')
        expect(url).toContain('client_id=test-client-id')
        expect(url).toContain(
            'redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback',
        )
        expect(url).toContain('scope=openid+email+name+picture')
        expect(url).toContain('response_type=code')
        expect(url).toContain('response_mode=query')
    })

    it('should include custom scopes', () => {
        const url = buildHelloAuthURL({
            ...baseParams,
            scopes: ['openid', 'email', 'github', 'discord'],
        })

        expect(url).toContain('scope=openid+email+github+discord')
    })

    it('should add provider_hint as string', () => {
        const url = buildHelloAuthURL({
            ...baseParams,
            providerHint: 'github google',
        })

        expect(url).toContain('provider_hint=github+google')
    })

    it('should add provider_hint as array', () => {
        const url = buildHelloAuthURL({
            ...baseParams,
            providerHint: ['github', 'google', 'discord'],
        })

        expect(url).toContain('provider_hint=github+google+discord')
    })

    it('should add domain_hint', () => {
        const url = buildHelloAuthURL({
            ...baseParams,
            domainHint: 'managed',
        })

        expect(url).toContain('domain_hint=managed')
    })

    it('should add login_hint', () => {
        const url = buildHelloAuthURL({
            ...baseParams,
            loginHint: 'user@example.com',
        })

        expect(url).toContain('login_hint=user%40example.com')
    })

    it('should add prompt', () => {
        const url = buildHelloAuthURL({
            ...baseParams,
            prompt: 'login consent',
        })

        expect(url).toContain('prompt=login+consent')
    })

    it('should add state', () => {
        const url = buildHelloAuthURL({
            ...baseParams,
            state: 'random-state-123',
        })

        expect(url).toContain('state=random-state-123')
    })

    it('should add nonce', () => {
        const url = buildHelloAuthURL({
            ...baseParams,
            nonce: 'random-nonce-456',
        })

        expect(url).toContain('nonce=random-nonce-456')
    })

    it('should handle all Hellō-specific parameters together', () => {
        const url = buildHelloAuthURL({
            ...baseParams,
            scopes: ['openid', 'email', 'github'],
            providerHint: ['github', 'discord'],
            domainHint: 'hello.coop',
            loginHint: 'user@hello.coop',
            prompt: 'login consent',
            state: 'state-123',
            nonce: 'nonce-456',
        })

        expect(url).toContain('scope=openid+email+github')
        expect(url).toContain('provider_hint=github+discord')
        expect(url).toContain('domain_hint=hello.coop')
        expect(url).toContain('login_hint=user%40hello.coop')
        expect(url).toContain('prompt=login+consent')
        expect(url).toContain('state=state-123')
        expect(url).toContain('nonce=nonce-456')
    })

    it('should omit optional parameters when not provided', () => {
        const url = buildHelloAuthURL(baseParams)

        expect(url).not.toContain('provider_hint')
        expect(url).not.toContain('domain_hint')
        expect(url).not.toContain('login_hint')
        expect(url).not.toContain('prompt')
        expect(url).not.toContain('state')
        expect(url).not.toContain('nonce')
    })

    it('should handle provider_hint with demote syntax', () => {
        const url = buildHelloAuthURL({
            ...baseParams,
            providerHint: 'google--',
        })

        expect(url).toContain('provider_hint=google--')
    })

    it('should handle email login_hint with mailto prefix', () => {
        const url = buildHelloAuthURL({
            ...baseParams,
            loginHint: 'mailto:user@example.com',
        })

        expect(url).toContain('login_hint=mailto%3Auser%40example.com')
    })

    it('should handle sub-based login_hint', () => {
        const url = buildHelloAuthURL({
            ...baseParams,
            loginHint: 'sub_01234567abcdefghABCDEFGH_XXX',
        })

        expect(url).toContain('login_hint=sub_01234567abcdefghABCDEFGH_XXX')
    })
})
