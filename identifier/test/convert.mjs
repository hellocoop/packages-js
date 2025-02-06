import { expect } from 'chai'

import identifier from '../dist/identifier.mjs'

const UUIDv4 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
const INVALID_UUIDv4 = 'invalid-uuid'

describe('Identifier Conversion Tests', () => {
    it('should convert UUIDv4 to a valid nanoid', () => {
        const type = 'sub'
        const nanoid = identifier.nanoidFromUUIDv4(type, UUIDv4)
        expect(nanoid).to.be.a('string')
        expect(nanoid).to.match(/^sub_[0-9a-zA-Z]{24}_[0-9a-zA-Z]{3}$/)

        const [prefix, id, checksum] = nanoid.split('_')
        expect(prefix).to.equal(type)
        expect(id).to.have.lengthOf(24)
        expect(checksum).to.have.lengthOf(3)
    })

    it('should convert nanoid back to the correct UUIDv4', () => {
        const type = 'sub'
        const nanoid = identifier.nanoidFromUUIDv4(type, UUIDv4)
        const convertedUuid = identifier.uuidv4FromNanoid(nanoid)
        expect(convertedUuid).to.equal(UUIDv4)
    })

    it('should throw an error when an unknown identifier type is provided', () => {
        const type = 'unknown'
        expect(() => identifier.nanoidFromUUIDv4(type, UUIDv4)).to.throw(
            `Unknown identifier type: ${type}`,
        )
    })

    it('should throw an error when an invalid UUIDv4 is provided', () => {
        expect(() =>
            identifier.nanoidFromUUIDv4('sub', INVALID_UUIDv4),
        ).to.throw(`Invalid UUIDv4: ${INVALID_UUIDv4}`)
    })

    it('should throw an error when an invalid nanoid is provided', () => {
        const invalidNanoid = 'sub_invalid_nanoid'
        expect(() => identifier.uuidv4FromNanoid(invalidNanoid)).to.throw(
            `Invalid nanoid: ${invalidNanoid}`,
        )
    })

    it('should throw an error when an nanoid is too long', () => {
        const tooLongNanoid = 'sub_LbuQ29vpFAlAzrRq3mgnFIzF_Cu8'
        expect(() => identifier.uuidv4FromNanoid(tooLongNanoid)).to.throw(
            `NanoId is too long: ${tooLongNanoid}`,
        )
    })
})
