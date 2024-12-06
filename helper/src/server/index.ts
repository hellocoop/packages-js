// wrapper all modules

export * from './errorPage'
export * from '../common/createAuthRequest'
export * from '../common/createInviteRequest'
export * from '../common/fetchToken'
export * from '../common/parseToken'
export * from './redirectURIBounce'
export * from './wildcardConsole'
export * from './crypto'
export * from './sameSite'


// crypto wrapper for PKCE
import * as crypto from 'crypto';
import { generateChallenge, pkce, verifyChallenge, setCrypto} from '../common/pkce';
setCrypto(crypto);
export { generateChallenge, verifyChallenge, pkce }