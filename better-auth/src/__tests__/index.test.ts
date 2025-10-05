import { describe, it, expect } from 'vitest'
import { hellocoop } from '../index'

describe('hellocoop plugin', () => {
    it('should return a plugin object with minimal config', () => {
        const plugin = hellocoop({
            clientId: 'test-client-id',
        })

        expect(plugin).toBeDefined()
        expect(plugin.id).toBeDefined()
    })

    it('should accept custom scopes', () => {
        const plugin = hellocoop({
            clientId: 'test-client-id',
            scopes: ['email', 'github', 'discord'],
        })

        expect(plugin).toBeDefined()
    })

    it('should handle all Hellō scope types', () => {
        const plugin = hellocoop({
            clientId: 'test-client-id',
            scopes: [
                'openid',
                'email',
                'name',
                'nickname',
                'given_name',
                'family_name',
                'phone',
                'picture',
                'profile',
                'preferred_username',
                'github',
                'discord',
                'gitlab',
                'twitter',
                'ethereum',
                'profile_update',
            ],
        })

        expect(plugin).toBeDefined()
    })
})
