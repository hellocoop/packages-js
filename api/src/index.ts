export {
    default as configuration,
    configure,
    configurationError,
    isConfigured,
    resetConfiguration,
} from './lib/config'
export { clearAuthCookieParams, getAuthfromCookies } from './lib/auth'
export { default as router } from './handlers/router'
export { PackageMetadata } from './lib/packageMetadata'
export * from './types'
