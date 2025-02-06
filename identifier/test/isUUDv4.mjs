// isUUIDv4.mjs

import { expect } from 'chai'

// Define the regex and the isUUIDv4 function as in your source code
const uuidRegex =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/
const isUUIDv4 = (id) => uuidRegex.test(id)

describe('isUUIDv4 Function', function () {
    it('should validate correct UUID v4 strings', function () {
        const validUUIDs = [
            '550e8400-e29b-41d4-a716-446655440000',
            'a8098c1a-f86e-4e30-8e44-000000000000',
            '16fd2706-8baf-433b-82eb-8c7fada847da',
            '1d7b4a1e-2fac-4f53-9a9e-43c738b20a5f',
        ]

        validUUIDs.forEach((uuid) => {
            expect(isUUIDv4(uuid)).to.be.true
        })
    })

    it('should invalidate incorrect UUID v4 strings', function () {
        const invalidUUIDs = [
            '550e8400e29b41d4a716446655440000', // Missing hyphens
            '550e8400-e29b-41d4-a716-44665544000', // One character short
            '550e8400-e29b-41d4-a716-4466554400000', // One character extra
            '550e8400-e29b-51d4-a716-446655440000', // Wrong variant
            '550e8400-e29b-41d4-g716-446655440000', // Invalid character
            'z50e8400-e29b-41d4-a716-446655440000', // Invalid character in the start
        ]

        invalidUUIDs.forEach((uuid) => {
            expect(isUUIDv4(uuid)).to.be.false
        })
    })
})
