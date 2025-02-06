import { auth, HelloConfig } from './auth'
export default auth
export { auth as helloAuth, HelloConfig }
export {
    LoginSyncResponse,
    LogoutSyncResponse,
    LoginSyncParams,
} from '@hellocoop/api'
export { redirect, unauthorized, setAuth } from './middleware'
