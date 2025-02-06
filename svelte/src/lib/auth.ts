/// <reference types="svelte" />
// @ts-ignore tbd
import { useSWR } from 'sswr'
import type { Readable } from 'svelte/store'
import type { Claims } from './types.js'
// @ts-ignore tbd - has no exported member?
import { getHelloProviderContext, routeConfig } from './Provider.svelte'

const fetcher = async (url: string): Promise<Auth | undefined> => {
    try {
        const response = await fetch(url)
        const auth = await response.json()
        return auth
    } catch (err) {
        console.error(err)
        return undefined
    }
}

type AuthCookie = {
    sub: string
    iat: number
} & Claims & {
        [key: string]: any // Allow arbitrary optional properties
    }

export type Auth =
    | {
          isLoggedIn: false
      }
    | ({
          isLoggedIn: true
      } & AuthCookie)

export type AuthState = {
    auth: Auth | {}
    isLoading: Readable<boolean>
    isLoggedIn: Readable<boolean> | undefined
}

export const useAuth = (): AuthState => {
    const defaultAuth: Auth | undefined = getHelloProviderContext()
    const {
        data: auth,
        isLoading,
    }: { data: any; isLoading: Readable<boolean> } = useSWR(routeConfig.auth, {
        fetcher,
        initialData: defaultAuth,
    })
    return {
        auth: auth || {},
        isLoading,
        isLoggedIn: auth?.isLoggedIn,
    }
}
