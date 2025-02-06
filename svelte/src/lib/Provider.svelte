<script context="module" lang="ts">
    import type { Auth } from './auth.js'
    import { setContext, getContext } from 'svelte'

    export const routeConfig = {
        login: '/api/hellocoop?login=true',
        auth: '/api/hellocoop?auth=true',
        logout: '/api/hellocoop?logout=true',
    }

    export const getHelloProviderContext = (): Auth | undefined => {
        return getContext('HelloProviderContext')
    }
</script>

<script lang="ts">
    export let auth: any = {} //tbd: any
    export let config: any = {} //tbd: any

    setContext('HelloProviderContext', auth)

    if (config?.login) routeConfig.login = config.login
    if (config?.auth) routeConfig.auth = config.auth
    if (config?.logout) routeConfig.logout = config.logout
</script>

<slot />
