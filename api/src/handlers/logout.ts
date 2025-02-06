import { HelloRequest, HelloResponse } from '../types'
import { clearAuthCookie } from '../lib/auth'
import config from '../lib/config'

const handleLogout = async (req: HelloRequest, res: HelloResponse) => {
    const { target_uri } = req.query
    clearAuthCookie(res)
    if (config.logoutSync) {
        const e = await req.logoutSyncWrapper(config.logoutSync)
        if (e) console.log(new Error('logoutSync faulted'), e)
    }
    res.redirect((target_uri as string) || config.routes.loggedOut || '/')
}

export default handleLogout
