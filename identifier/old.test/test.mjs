import identifiers from '../dist/identifier.mjs'

const runTests = async () => {
    try {
        await new Promise((resolve) => setTimeout(resolve, 100)) // Ensure nanoid is loaded

        const validId = identifiers.app()
        console.log('Valid ID:', validId)
        console.log('Is valid:', identifiers.validate(validId)) // Should print: true
    } catch (error) {
        console.error('Error generating valid ID:', error)
    }

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
        console.log(`Test ${index + 1}:`, id)
        console.log('Is valid:', identifiers.validate(id)) // Should print: false
    })
}

runTests()
