/**
 * @hellocoop/httpsig
 * HTTP Message Signatures (RFC 9421) with Signature-Key header support
 */

export { fetch } from './fetch.js'
export { verify } from './verify.js'

export {
    expressVerify,
    fastifyVerify,
    nextJsVerify,
    nextJsPagesVerify,
} from './helpers.js'

export {
    generateSignatureErrorHeader,
    parseSignatureError,
    generateAcceptSignatureHeader,
    parseAcceptSignature,
    generateAcceptSignatureSchemeHeader,
    parseAcceptSignatureScheme,
    generateAcceptSignatureAlgHeader,
    parseAcceptSignatureAlg,
} from './utils/signature.js'

/**
 * RFC 8941 Structured Field Values.
 *
 * Exported so that consumers parsing neighbouring structured fields --
 * AAuth-Requirement is a Dictionary, AAuth-Capabilities a List of Tokens --
 * use the implementation this package already carries instead of hand-rolling
 * one. Hand-rolled 8941 fails on quoting, escaping and byte sequences every
 * time; a `;` inside a quoted `url` is enough to break a naive parameter
 * split.
 */
export {
    parseDictionary,
    parseList,
    parseItem,
    serializeDictionary,
    serializeList,
    serializeItem,
    serializeInnerList,
    serializeBareItem,
    serializeParameters,
    bareItemToString,
    isInnerList,
    isByteSequence,
    isValidTokenStr,
    isValidKeyStr,
    Token,
    ByteSequence,
    ParseError,
    SerializeError,
} from './structured-fields.js'

export type {
    Dictionary,
    List,
    Item,
    InnerList,
    Parameters,
    BareItem,
} from './structured-fields.js'

export {
    generateKeyPair,
    determineAlgorithm,
    SUPPORTED_ALGORITHMS,
} from './utils/crypto.js'
export type {
    GenerateKeyPairOptions,
    GeneratableAlgorithm,
    KeyPair,
} from './utils/crypto.js'

export { SignatureVerificationError } from './errors.js'

export { calculateThumbprint } from './utils/thumbprint.js'

export type {
    HttpSigFetchOptions,
    HttpSigFetchResultWithSent,
    SentRequest,
    SignatureKeyType,
    VerifyRequest,
    VerifyOptions,
    VerificationResult,
    SignatureError,
    SignatureErrorCode,
    SignatureKeyScheme,
    SignatureAlgorithm,
    AcceptSignatureParams,
} from './types.js'

export {
    VALID_DERIVED_COMPONENTS,
    DEFAULT_COMPONENTS_GET,
    DEFAULT_COMPONENTS_BODY,
} from './types.js'
