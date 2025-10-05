import { describe, it, expect } from 'vitest'
import {
    HELLO_DISCOVERY_URL,
    HELLO_ISSUER,
    DEFAULT_HELLO_SCOPES,
    HELLO_SCOPES,
    HELLO_PROVIDERS,
} from '../constants'

describe('Constants', () => {
    describe('HELLO_DISCOVERY_URL', () => {
        it('should point to Hellō well-known configuration', () => {
            expect(HELLO_DISCOVERY_URL).toBe(
                'https://issuer.hello.coop/.well-known/openid-configuration',
            )
        })
    })

    describe('HELLO_ISSUER', () => {
        it('should be the correct Hellō issuer URL', () => {
            expect(HELLO_ISSUER).toBe('https://issuer.hello.coop')
        })
    })

    describe('DEFAULT_HELLO_SCOPES', () => {
        it('should contain the four default scopes', () => {
            expect(DEFAULT_HELLO_SCOPES).toEqual([
                'openid',
                'email',
                'name',
                'picture',
            ])
        })

        it('should always include openid', () => {
            expect(DEFAULT_HELLO_SCOPES).toContain('openid')
        })
    })

    describe('HELLO_SCOPES', () => {
        it('should have OPENID scope', () => {
            expect(HELLO_SCOPES.OPENID).toBe('openid')
        })

        it('should have standard identity scopes', () => {
            expect(HELLO_SCOPES.EMAIL).toBe('email')
            expect(HELLO_SCOPES.NAME).toBe('name')
            expect(HELLO_SCOPES.NICKNAME).toBe('nickname')
            expect(HELLO_SCOPES.GIVEN_NAME).toBe('given_name')
            expect(HELLO_SCOPES.FAMILY_NAME).toBe('family_name')
            expect(HELLO_SCOPES.PHONE).toBe('phone')
            expect(HELLO_SCOPES.PICTURE).toBe('picture')
            expect(HELLO_SCOPES.PROFILE).toBe('profile')
            expect(HELLO_SCOPES.PREFERRED_USERNAME).toBe('preferred_username')
        })

        it('should have social account scopes', () => {
            expect(HELLO_SCOPES.DISCORD).toBe('discord')
            expect(HELLO_SCOPES.GITHUB).toBe('github')
            expect(HELLO_SCOPES.GITLAB).toBe('gitlab')
            expect(HELLO_SCOPES.TWITTER).toBe('twitter')
        })

        it('should have other scopes', () => {
            expect(HELLO_SCOPES.ETHEREUM).toBe('ethereum')
            expect(HELLO_SCOPES.PROFILE_UPDATE).toBe('profile_update')
        })
    })

    describe('HELLO_PROVIDERS', () => {
        it('should have major OAuth providers', () => {
            expect(HELLO_PROVIDERS.GOOGLE).toBe('google')
            expect(HELLO_PROVIDERS.APPLE).toBe('apple')
            expect(HELLO_PROVIDERS.MICROSOFT).toBe('microsoft')
            expect(HELLO_PROVIDERS.FACEBOOK).toBe('facebook')
        })

        it('should have developer-focused providers', () => {
            expect(HELLO_PROVIDERS.GITHUB).toBe('github')
            expect(HELLO_PROVIDERS.GITLAB).toBe('gitlab')
            expect(HELLO_PROVIDERS.DISCORD).toBe('discord')
        })

        it('should have social providers', () => {
            expect(HELLO_PROVIDERS.TWITTER).toBe('twitter')
            expect(HELLO_PROVIDERS.TUMBLR).toBe('tumblr')
            expect(HELLO_PROVIDERS.MASTODON).toBe('mastodon')
            expect(HELLO_PROVIDERS.TWITCH).toBe('twitch')
        })

        it('should have alternative providers', () => {
            expect(HELLO_PROVIDERS.LINE).toBe('line')
            expect(HELLO_PROVIDERS.WORDPRESS).toBe('wordpress')
            expect(HELLO_PROVIDERS.YAHOO).toBe('yahoo')
            expect(HELLO_PROVIDERS.PHONE).toBe('phone')
            expect(HELLO_PROVIDERS.ETHEREUM).toBe('ethereum')
            expect(HELLO_PROVIDERS.QRCODE).toBe('qrcode')
        })

        it('should have demote syntax for default providers', () => {
            expect(HELLO_PROVIDERS.APPLE_DEMOTE).toBe('apple--')
            expect(HELLO_PROVIDERS.MICROSOFT_DEMOTE).toBe('microsoft--')
        })
    })
})
