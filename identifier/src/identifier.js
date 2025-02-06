// identifier.js - only used during build

// identifierTypesSet added by build script

// generateId added by build script

/* global HELLO_ALPHABET, identifierTypesSet, identifierTypes, generateId -- these come from ./build.js */

const HELLO_REGEX = new RegExp(`^[${HELLO_ALPHABET}]+$`)

const checksum = (prefix, id) => {
    const pb = Buffer.from(prefix)
    const dib = Buffer.from(id)
    const a =
        pb[0] + dib[0] + dib[3] + dib[6] + dib[9] + dib[12] + dib[15] + dib[18]
    const b =
        pb[1] + dib[1] + dib[4] + dib[7] + dib[10] + dib[13] + dib[16] + dib[19]
    const c =
        pb[2] + dib[2] + dib[5] + dib[8] + dib[11] + dib[14] + dib[17] + dib[20]
    return (
        HELLO_ALPHABET[a % 62] + HELLO_ALPHABET[b % 62] + HELLO_ALPHABET[c % 62]
    )
}

// Doh! ... gen AI failed in picking the right indexes for the checksum calculation
// some ids use this checksum calculation, so we need to keep it around
const oldChecksum = (prefix, id) => {
    const pb = Buffer.from(prefix)
    const dib = Buffer.from(id)
    const a =
        pb[0] + dib[0] + dib[3] + dib[7] + dib[10] + dib[14] + dib[17] + dib[21]
    const b =
        pb[1] + dib[1] + dib[4] + dib[8] + dib[11] + dib[15] + dib[18] + dib[22]
    const c =
        pb[2] + dib[2] + dib[5] + dib[9] + dib[12] + dib[16] + dib[19] + dib[23]
    return (
        HELLO_ALPHABET[a % 62] + HELLO_ALPHABET[b % 62] + HELLO_ALPHABET[c % 62]
    )
}

const validate = (identifier) => {
    const parts = identifier.split('_')
    if (parts.length !== 3) {
        return false // Invalid format
    }

    const [prefix, id, providedChecksum] = parts

    if (!identifierTypesSet.has(prefix)) {
        return false // Unknown prefix
    }

    if (id.length !== 24 || providedChecksum.length !== 3) {
        return false // Invalid length
    }

    if (!HELLO_REGEX.test(id) || !HELLO_REGEX.test(providedChecksum)) {
        return false // Invalid parts
    }

    const calculatedChecksum = checksum(prefix, id)

    let valid = providedChecksum === calculatedChecksum
    if (!valid) {
        // try the old checksum calculation
        valid = providedChecksum === oldChecksum(prefix, id)
    }

    return valid
}

const nano_id = (prefix) => {
    if (!generateId) {
        throw new Error(
            'nanoid is not ready. Ensure that loadNanoid has been called and completed.',
        )
    }
    const id = generateId()
    return `${prefix}_${id}_${checksum(prefix, id)}`
}

const generators = identifierTypes.reduce((acc, type) => {
    acc[type] = () => nano_id(type)
    return acc
}, {})

const uuidRegex =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/

const uuidv4FromNanoid = (nanoid) => {
    if (!validate(nanoid)) {
        throw new Error(`Invalid nanoid: ${nanoid}`)
    }
    const base62 = nanoid.slice(4, -4)
    let num = BigInt(0)
    const base = BigInt(62)
    for (const char of base62) {
        num = num * base + BigInt(HELLO_ALPHABET.indexOf(char))
    }
    const hexString = num.toString(16).padStart(32, '0')
    if (hexString.length !== 32) {
        throw new Error(`NanoId is too long: ${nanoid}`)
    }
    const uuidv4 = `${hexString.slice(0, 8)}-${hexString.slice(8, 12)}-${hexString.slice(12, 16)}-${hexString.slice(16, 20)}-${hexString.slice(20)}`
    return uuidv4
}

const nanoidFromUUIDv4 = (type, uuidv4) => {
    if (!identifierTypesSet.has(type))
        throw new Error(`Unknown identifier type: ${type}`)
    if (!uuidRegex.test(uuidv4)) throw new Error(`Invalid UUIDv4: ${uuidv4}`)
    // Remove hyphens and convert to a BigInt
    const hexString = uuidv4.replace(/-/g, '')
    let num = BigInt(`0x${hexString}`)
    // Convert to base62
    let base62 = ''
    const base = BigInt(HELLO_ALPHABET.length)
    while (num > 0n) {
        base62 = HELLO_ALPHABET[num % base] + base62
        num = num / base
    }
    // Pad with the first character of HELLO_ALPHABET to ensure fixed length
    while (base62.length < 24) {
        base62 = HELLO_ALPHABET[0] + base62
    }
    const chk = checksum(type, base62)
    const nanoid = `${type}_${base62}_${chk}`
    return nanoid
}

Object.freeze(identifierTypes)

generators.validate = validate
generators.checksum = checksum
generators.HELLO_ALPHABET = HELLO_ALPHABET
generators.types = identifierTypes
generators.isUUIDv4 = (id) => uuidRegex.test(id)
generators.nanoidFromUUIDv4 = nanoidFromUUIDv4
generators.uuidv4FromNanoid = uuidv4FromNanoid

/*
 * export and modules.exports statements added by build script
 */
