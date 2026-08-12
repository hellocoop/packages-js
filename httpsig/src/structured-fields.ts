/**
 * RFC 8941 Structured Field Values for HTTP
 *
 * This is the package's single structured-field implementation. Every header
 * it reads or writes -- Signature, Signature-Input, Signature-Key,
 * Signature-Error, Accept-Signature, Accept-Signature-Scheme,
 * Accept-Signature-Alg -- goes through it, and it is exported so that
 * consumers parsing neighbouring fields (AAuth-Requirement, a Dictionary;
 * AAuth-Capabilities, a List of Tokens) do not write a fourth one.
 *
 * The implementation is vendored, not depended on: see
 * `src/vendor/structured-headers/README.md` for what was taken, from which
 * version, and why. This module is the seam -- nothing outside it should
 * import from `vendor/` directly.
 *
 * Shapes, briefly:
 *
 *   Dictionary  Map<string, Item | InnerList>
 *   List        (Item | InnerList)[]
 *   Item        [BareItem, Parameters]
 *   InnerList   [Item[], Parameters]
 *   Parameters  Map<string, BareItem>
 *   BareItem    number | string | Token | ByteSequence | boolean
 *
 * A `Token` is a bare word (`hwk`, `Ed25519`); a `string` is a quoted
 * sf-string. They are distinct types, and the distinction is load-bearing:
 * `requirement=interaction` and `requirement="interaction"` are different
 * values, and a parser that erases the difference cannot round-trip.
 */

export {
    parseDictionary,
    parseList,
    parseItem,
    ParseError,
} from './vendor/structured-headers/parser.js'

export {
    serializeDictionary,
    serializeList,
    serializeItem,
    serializeInnerList,
    serializeBareItem,
    serializeParameters,
    SerializeError,
} from './vendor/structured-headers/serializer.js'

export { Token } from './vendor/structured-headers/token.js'
export { ByteSequence } from './vendor/structured-headers/types.js'
export {
    isInnerList,
    isByteSequence,
    isValidTokenStr,
    isValidKeyStr,
} from './vendor/structured-headers/util.js'

export type {
    Dictionary,
    List,
    Item,
    InnerList,
    Parameters,
    BareItem,
} from './vendor/structured-headers/types.js'

import { BareItem } from './vendor/structured-headers/types.js'
import { Token } from './vendor/structured-headers/token.js'

/**
 * Read a Bare Item that is expected to carry text.
 *
 * Returns the value of a String or a Token, and throws for anything else. The
 * Token case is deliberate leniency: several fields in this family are
 * specified to carry Strings, but a sender that omits the quotes produces a
 * Token that means the same thing to a human and parses unambiguously. Values
 * that cannot be text -- Integers, Decimals, Booleans, Byte Sequences -- are
 * rejected rather than stringified, so a type confusion surfaces as an error
 * instead of a plausible-looking string.
 */
export function bareItemToString(value: BareItem): string {
    if (typeof value === 'string') {
        return value
    }
    if (value instanceof Token) {
        return value.toString()
    }
    throw new TypeError(
        `Expected a Structured Field String or Token, got ${typeof value}`,
    )
}
