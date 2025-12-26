/**
 * Framework-specific helpers for using httpsig with popular Node.js frameworks
 */

import { VerifyOptions, VerificationResult } from './types.js'
import { verify } from './verify.js'

/**
 * Verify HTTP Message Signature for Express request
 *
 * IMPORTANT: Must use express.raw() middleware, NOT express.json()!
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { expressVerify } from '@hellocoop/httpsig';
 *
 * const app = express();
 *
 * // Use raw middleware to preserve body bytes
 * app.use(express.raw({ type: 'application/json' }));
 *
 * app.use(async (req, res, next) => {
 *   const result = await expressVerify(req);
 *   if (result.verified) {
 *     req.signature = result;
 *     next();
 *   } else {
 *     res.status(401).json({ error: result.error });
 *   }
 * });
 * ```
 */
export async function expressVerify(
    req: {
        method: string
        protocol: string
        hostname: string
        originalUrl: string
        headers: Record<string, string | string[]>
        body?: Buffer | string
    },
    options?: VerifyOptions,
): Promise<VerificationResult> {
    // Construct full URL from Express request
    const fullUrl = `${req.protocol}://${req.hostname}${req.originalUrl}`

    return verify(
        {
            method: req.method,
            url: fullUrl,
            headers: req.headers,
            body: req.body,
        },
        options,
    )
}

/**
 * Verify HTTP Message Signature for Fastify request
 *
 * IMPORTANT: Must configure Fastify to preserve raw body!
 *
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import { fastifyVerify } from '@hellocoop/httpsig';
 *
 * const fastify = Fastify({
 *   // Preserve raw body for signature verification
 *   preParsing: async (request, reply, payload) => {
 *     const chunks: Buffer[] = [];
 *     for await (const chunk of payload) {
 *       chunks.push(chunk);
 *     }
 *     request.rawBody = Buffer.concat(chunks);
 *     return Buffer.concat(chunks);
 *   }
 * });
 *
 * fastify.addHook('preHandler', async (request, reply) => {
 *   const result = await fastifyVerify(request);
 *   if (!result.verified) {
 *     reply.code(401).send({ error: result.error });
 *     return;
 *   }
 *   request.signature = result;
 * });
 * ```
 */
export async function fastifyVerify(
    request: {
        method: string
        protocol: string
        hostname: string
        url: string
        headers: Record<string, string | string[]>
        rawBody?: Buffer | string
    },
    options?: VerifyOptions,
): Promise<VerificationResult> {
    // Construct full URL from Fastify request
    const fullUrl = `${request.protocol}://${request.hostname}${request.url}`

    return verify(
        {
            method: request.method,
            url: fullUrl,
            headers: request.headers,
            body: request.rawBody,
        },
        options,
    )
}

/**
 * Verify HTTP Message Signature for Next.js App Router
 *
 * IMPORTANT: You must consume the body BEFORE verification!
 *
 * @example
 * ```typescript
 * import { nextJsVerify } from '@hellocoop/httpsig';
 *
 * export async function POST(request: Request) {
 *   // Consume body as text BEFORE verification
 *   const body = await request.text();
 *
 *   const result = await nextJsVerify(request, body);
 *
 *   if (!result.verified) {
 *     return Response.json({ error: result.error }, { status: 401 });
 *   }
 *
 *   // Parse body after verification
 *   const data = JSON.parse(body);
 *   // ... handle request
 * }
 * ```
 */
export async function nextJsVerify(
    request: Request,
    body?: string,
    options?: VerifyOptions,
): Promise<VerificationResult> {
    return verify(
        {
            method: request.method,
            url: request.url,
            headers: request.headers,
            body,
        },
        options,
    )
}

/**
 * Verify HTTP Message Signature for Next.js Pages Router
 *
 * IMPORTANT: Must disable body parsing and read raw body!
 *
 * @example
 * ```typescript
 * import type { NextApiRequest, NextApiResponse } from 'next';
 * import { nextJsPagesVerify } from '@hellocoop/httpsig';
 * import getRawBody from 'raw-body';
 *
 * export const config = {
 *   api: {
 *     bodyParser: false, // Disable automatic body parsing
 *   },
 * };
 *
 * export default async function handler(
 *   req: NextApiRequest,
 *   res: NextApiResponse
 * ) {
 *   // Read raw body
 *   const rawBody = await getRawBody(req);
 *
 *   const result = await nextJsPagesVerify(req, rawBody);
 *
 *   if (!result.verified) {
 *     return res.status(401).json({ error: result.error });
 *   }
 *
 *   // ... handle request
 * }
 * ```
 */
export async function nextJsPagesVerify(
    req: {
        method?: string
        headers: Record<string, string | string[]>
        url?: string
    },
    body?: Buffer | string,
    host?: string,
    options?: VerifyOptions,
): Promise<VerificationResult> {
    // Construct full URL
    const protocol = 'https' // Next.js production is always HTTPS
    const hostname = host || (req.headers.host as string) || 'localhost'
    const path = req.url || '/'
    const fullUrl = `${protocol}://${hostname}${path}`

    return verify(
        {
            method: req.method || 'GET',
            url: fullUrl,
            headers: req.headers,
            body,
        },
        options,
    )
}
