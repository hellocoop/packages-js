/**
 * Vendored from structured-headers v1.0.1 (MIT). See README.md in this
 * directory. Upstream: src/util.ts
 */

import { Item, InnerList, BareItem, ByteSequence } from './types.js'

const asciiRe = /^[\x20-\x7E]*$/
const tokenRe = /^[a-zA-Z*][:/!#$%&'*+\-.^_`|~A-Za-z0-9]*$/
const keyRe = /^[a-z*][*\-_.a-z0-9]*$/

export function isAscii(str: string): boolean {
    return asciiRe.test(str)
}

export function isValidTokenStr(str: string): boolean {
    return tokenRe.test(str)
}

export function isValidKeyStr(str: string): boolean {
    return keyRe.test(str)
}

export function isInnerList(input: Item | InnerList): input is InnerList {
    return Array.isArray(input[0])
}

export function isByteSequence(input: BareItem): input is ByteSequence {
    return typeof input === 'object' && 'base64Value' in input
}
