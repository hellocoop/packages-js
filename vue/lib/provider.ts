import { provide, inject } from 'vue'

export type RouteConfig = {
    login: string
    auth: string
    logout: string
}
export const routeConfig: RouteConfig = {
    login: '/api/hellocoop?login=true',
    auth: '/api/hellocoop?auth=true',
    logout: '/api/hellocoop?logout=true',
}

const PROVIDER_KEY = 'HelloAuth'

export const useHelloProviderContext = () => inject(PROVIDER_KEY)

export default {
    props: ['auth', 'config'],
    setup(props: any) {
        //TBD any
        if (props?.config?.login) routeConfig.login = props.config.login
        if (props?.config?.auth) routeConfig.auth = props.config.auth
        if (props?.config?.logout) routeConfig.logout = props.config.logout

        provide(PROVIDER_KEY, props.auth)
    },
    render(): void {
        // @ts-ignore //tbd
        return this.$slots.default()
    },
}
