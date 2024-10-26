import useSWRV from 'swrv'
import type { Claims } from './types'

import { useHelloProviderContext, routeConfig } from "./provider"

const fetcher = async (url: string): Promise<Auth | undefined> => {
    try {
        const response = await fetch(url)
        const auth = await response.json()
        return auth
    } catch( err ) {
        console.error(err) 
        return undefined
    }
}

type AuthCookie = {
        sub: string,
        iat: number
    } & Claims & {
        [key: string]: any; // Allow arbitrary optional properties
    }

export type Auth = {
    isLoggedIn: false
} | ({
    isLoggedIn: true,
} & AuthCookie )


export type AuthState = {
    auth: Auth | {}, 
    isLoading: boolean,
    isLoggedIn: boolean | undefined
}

export const useAuth = (): AuthState => {
    // @ts-ignore //TBD
    const defaultAuth: Auth | undefined = useHelloProviderContext()
    const { data: auth = defaultAuth, isValidating: isLoading } = useSWRV(routeConfig.auth, fetcher)
    return { 
        auth: auth || {}, 
        // @ts-ignore //TBD
        isLoading, 
        // @ts-ignore
        isLoggedIn: auth?.isLoggedIn }
}

