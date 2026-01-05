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

export type {
    HttpSigFetchOptions,
    SignatureKeyType,
    VerifyRequest,
    VerifyOptions,
    VerificationResult,
} from './types.js'

export {
    VALID_DERIVED_COMPONENTS,
    DEFAULT_COMPONENTS_GET,
    DEFAULT_COMPONENTS_BODY,
} from './types.js'
