// utility for generating identifiers

import identifier from './dist/identifier.mjs'

const prefix = process.argv[2]
const id = process.argv[3]

if (!prefix) {
    console.error('Usage: node gen.mjs <prefix> <id>')
    process.exit(1)
}

if (!identifier.types.includes(prefix)) {
    console.error(`Unknown prefix: ${prefix}`)
    process.exit(1)
}

if (!id) {
    const i = identifier[prefix]()
    console.log(i)
    process.exit(0)
}

if (id.length > 24) {
    console.error(`ID too long ${id.length} - must be 24 characters`)
    process.exit(1)
}

if (id.length < 24) {
    console.error(`ID too short ${id.length} - must be 24 characters`)
    process.exit(1)
}

const check = identifier.checksum(prefix, id)
console.log(`${prefix}_${id}_${check}`)
process.exit(0)
