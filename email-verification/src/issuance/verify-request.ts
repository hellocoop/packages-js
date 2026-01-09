import { verify } from '@hellocoop/httpsig'
import type { VerifyRequest, VerifyOptions } from '@hellocoop/httpsig'
import type { JWK } from 'jose'
import type { IssuanceRequestBody, VerifiedIssuanceRequest } from '../types.js'
import { InvalidSignatureError, EmailValidationError } from '../errors.js'
import { isValidEmail } from '../utils/crypto.js'

/**
 * Options for verifying issuance requests
 */
export interface VerifyIssuanceRequestOptions {
    /** Max clock skew in seconds (default: 60) */
    maxClockSkew?: number
}

/**
 * Verifies an HTTP Message Signature on an issuance request
 * Used by issuers to verify incoming token requests from browsers
 *
 * @param request - The HTTP request to verify (method, authority, path, headers, body)
 * @param authority - The canonical authority of the issuance endpoint
 * @param options - Optional verification options
 * @returns Promise resolving to verified request data including email and public key
 * @throws InvalidSignatureError if signature verification fails
 * @throws EmailValidationError if email format is invalid
 */
export async function verifyIssuanceRequest(
    request: VerifyRequest,
    authority: string,
    options: VerifyIssuanceRequestOptions = {},
): Promise<VerifiedIssuanceRequest> {
    const { maxClockSkew = 60 } = options

    // Verify Sec-Fetch-Dest header
    const headers =
        request.headers instanceof Headers
            ? request.headers
            : new Headers(
                  Object.entries(request.headers).map(([k, v]) => [
                      k,
                      Array.isArray(v) ? v.join(', ') : v,
                  ]),
              )

    const secFetchDest = headers.get('sec-fetch-dest')
    if (secFetchDest !== 'email-verification') {
        throw new InvalidSignatureError(
            `Invalid Sec-Fetch-Dest header: expected 'email-verification', got '${secFetchDest}'`,
        )
    }

    // Verify Content-Type header
    const contentType = headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
        throw new InvalidSignatureError(
            `Invalid Content-Type header: expected 'application/json', got '${contentType}'`,
        )
    }

    // Verify the HTTP Message Signature using httpsig
    const verifyOptions: VerifyOptions = {
        maxClockSkew,
        strictAAuth: true,
    }

    const result = await verify(
        {
            method: request.method,
            authority,
            path: request.path,
            query: request.query,
            headers: request.headers,
            body: request.body,
        },
        verifyOptions,
    )

    if (!result.verified) {
        throw new InvalidSignatureError(
            `HTTP Message Signature verification failed: ${result.error || 'Unknown error'}`,
        )
    }

    // Verify required components are covered
    // Note: httpsig with strictAAuth=true should already validate this,
    // but we double-check for the EVP-specific requirements
    if (result.keyType !== 'hwk') {
        throw new InvalidSignatureError(
            `Invalid Signature-Key type: expected 'hwk', got '${result.keyType}'`,
        )
    }

    // Parse and validate the request body
    let body: IssuanceRequestBody
    try {
        let bodyStr: string
        if (typeof request.body === 'string') {
            bodyStr = request.body
        } else if (request.body) {
            // Handle Buffer and Uint8Array (Buffer extends Uint8Array)
            bodyStr = new TextDecoder().decode(request.body)
        } else {
            bodyStr = ''
        }
        body = JSON.parse(bodyStr) as IssuanceRequestBody
    } catch {
        throw new InvalidSignatureError('Invalid request body: not valid JSON')
    }

    // Validate required email field
    if (!body.email || typeof body.email !== 'string') {
        throw new InvalidSignatureError(
            'Invalid request body: missing or invalid email field',
        )
    }

    // Validate email format
    if (!isValidEmail(body.email)) {
        throw new EmailValidationError(`Invalid email format: ${body.email}`)
    }

    // Validate optional fields
    if (body.disposable !== undefined && typeof body.disposable !== 'boolean') {
        throw new InvalidSignatureError(
            'Invalid request body: disposable must be a boolean',
        )
    }

    if (
        body.directed_email !== undefined &&
        typeof body.directed_email !== 'string'
    ) {
        throw new InvalidSignatureError(
            'Invalid request body: directed_email must be a string',
        )
    }

    return {
        email: body.email,
        publicKey: result.publicKey as JWK,
        thumbprint: result.thumbprint,
        disposable: body.disposable,
        directed_email: body.directed_email,
    }
}

/**
 * Creates an error response object per specification
 *
 * @param error - Error code
 * @param description - Human-readable error description
 * @returns Error response object
 */
export function createErrorResponse(
    error: string,
    description: string,
): { error: string; error_description: string } {
    return {
        error,
        error_description: description,
    }
}
