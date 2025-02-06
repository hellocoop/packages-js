import { routeConfig } from './provider.js'

export const getLogOutRoute = () => routeConfig.logout

export function logOut() {
    window.location.href = routeConfig.logout
}
