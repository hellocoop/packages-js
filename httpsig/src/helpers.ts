/**
 * Framework-specific helpers for using httpsig with popular Node.js frameworks
 */

import { VerifyOptions, VerificationResult } from './types.js'
import { verify } from './verify.js'

/**
 * Verify HTTP Message Signature for Express request
 *
 * IMPORTANT:
 * - Must use express.raw() middleware, NOT express.json()!
 * - Must provide canonical authority (NOT from request headers - security!)
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
 *   // Provide your server's canonical authority (per AAuth Section 10.3.1)
 *   const result = await expressVerify(req, 'api.example.com');
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
    authority: string,
    options?: VerifyOptions,
): Promise<VerificationResult> {
    // Parse URL to extract path and query
    const urlObj = new URL(req.originalUrl, `${req.protocol}://${req.hostname}`)

    return verify(
        {
            method: req.method,
            authority,
            path: urlObj.pathname,
            query: urlObj.search ? urlObj.search.substring(1) : undefined,
            headers: req.headers,
            body: req.body,
        },
        options,
    )
}

/**
 * Verify HTTP Message Signature for Fastify request
 *
 * IMPORTANT:
 * - Must configure Fastify to preserve raw body!
 * - Must provide canonical authority (NOT from request headers - security!)
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
 *   // Provide your server's canonical authority (per AAuth Section 10.3.1)
 *   const result = await fastifyVerify(request, 'api.example.com');
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
    authority: string,
    options?: VerifyOptions,
): Promise<VerificationResult> {
    // Parse URL to extract path and query
    const urlObj = new URL(
        request.url,
        `${request.protocol}://${request.hostname}`,
    )

    return verify(
        {
            method: request.method,
            authority,
            path: urlObj.pathname,
            query: urlObj.search ? urlObj.search.substring(1) : undefined,
            headers: request.headers,
            body: request.rawBody,
        },
        options,
    )
}

/**
 * Verify HTTP Message Signature for Next.js App Router
 *
 * IMPORTANT:
 * - You must consume the body BEFORE verification!
 * - Must provide canonical authority (NOT from request URL - security!)
 *
 * @example
 * ```typescript
 * import { nextJsVerify } from '@hellocoop/httpsig';
 *
 * export async function POST(request: Request) {
 *   // Consume body as text BEFORE verification
 *   const body = await request.text();
 *
 *   // Provide your server's canonical authority (per AAuth Section 10.3.1)
 *   const result = await nextJsVerify(request, 'api.example.com', body);
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
    authority: string,
    body?: string,
    options?: VerifyOptions,
): Promise<VerificationResult> {
    // Parse URL to extract path and query
    const urlObj = new URL(request.url)

    return verify(
        {
            method: request.method,
            authority,
            path: urlObj.pathname,
            query: urlObj.search ? urlObj.search.substring(1) : undefined,
            headers: request.headers,
            body,
        },
        options,
    )
}

/**
 * Verify HTTP Message Signature for Next.js Pages Router
 *
 * IMPORTANT:
 * - Must disable body parsing and read raw body!
 * - Must provide canonical authority (NOT from request headers - security!)
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
 *   // Provide your server's canonical authority (per AAuth Section 10.3.1)
 *   const result = await nextJsPagesVerify(req, 'api.example.com', rawBody);
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
    authority: string,
    body?: Buffer | string,
    options?: VerifyOptions,
): Promise<VerificationResult> {
    const reqUrl = req.url || '/'

    // Parse URL to extract path and query
    const urlObj = new URL(reqUrl, `https://${authority}`)

    return verify(
        {
            method: req.method || 'GET',
            authority,
            path: urlObj.pathname,
            query: urlObj.search ? urlObj.search.substring(1) : undefined,
            headers: req.headers,
            body,
        },
        options,
    )
}
