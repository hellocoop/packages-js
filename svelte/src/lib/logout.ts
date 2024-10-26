/// <reference types="svelte" />

// @ts-ignore tbd - has no exported member?
import { routeConfig } from './Provider.svelte'

export const getLogOutRoute = () => routeConfig.logout

export function logOut() {
    window.location.href = routeConfig.logout
}