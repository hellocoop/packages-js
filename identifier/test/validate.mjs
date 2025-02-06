// test.mjs
import { describe, it } from 'mocha'
import { expect } from 'chai'
import identifiers from '../dist/identifier.mjs'

describe('Identifiers Module', function () {
    it('should generate a valid ID', async function () {
        await new Promise((resolve) => setTimeout(resolve, 100)) // Ensure nanoid is loaded
        const validId = identifiers.app()
        expect(identifiers.validate(validId)).to.be.true
    })

    const invalidIds = [
        'app_invalididentifier_000', // Invalid format (too short)
        'invalid_invalididentifier_000', // Unknown prefix
        'app_invalididentifier_', // Invalid format (missing checksum)
        'app_invalid!dentifier_000', // Invalid characters
        `app_${'A'.repeat(24)}_${'A'.repeat(2)}`, // Invalid checksum length
        `app_${'A'.repeat(23)}_000`, // Invalid ID length
        `app_${'!'.repeat(24)}_000`, // Invalid ID characters
        `${'!'.repeat(3)}_${'A'.repeat(24)}_000`, // Invalid prefix characters
        `app_${'A'.repeat(24)}_000`, // Invalid checksum (not matching calculated)
    ]

    invalidIds.forEach((id, index) => {
        it(`should invalidate incorrect ID - Test ${index + 1}`, function () {
            // console.log(`Test ${index + 1}:`, id);
            expect(identifiers.validate(id)).to.be.false
        })
    })
})
