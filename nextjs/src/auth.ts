
import { Auth, NotLoggedIn } from '@hellocoop/definitions'
import { configuration } from '@hellocoop/api'
import { cookies } from 'next/headers'
import { decryptObj } from '@hellocoop/helper-server'

// TODO cache decryption
// import { unstable_cache } from 'next/cache';
// https://nextjs.org/docs/app/api-reference/functions/unstable_cache

export const auth = async function (): Promise<Auth> {
    const authCookie = cookies().get(configuration.cookies.authName)?.value
    if (!authCookie)
        return NotLoggedIn
    const a = await decryptObj(authCookie, configuration.secret as string) as Auth
    if (!a)
        return NotLoggedIn
    return a 
}