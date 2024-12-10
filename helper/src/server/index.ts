// wrapper all modules

export * from './errorPage'
export * from '../common/createAuthRequest'
export * from '../common/createInviteRequest'
export * from '../common/fetchToken'
export * from './parseToken'
export * from './redirectURIBounce'
export * from './wildcardConsole'
export * from './crypto'
export * from './sameSite'


// crypto wrapper for PKCE
import * as _crypto from 'crypto';
import { generateChallenge, pkce, verifyChallenge, setCrypto} from '../common/pkce';
setCrypto(_crypto);
export { generateChallenge, verifyChallenge, pkce, pkce as pkceChallenge }