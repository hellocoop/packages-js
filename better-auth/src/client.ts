import type { hellocoop } from '.'
import type { BetterAuthClientPlugin } from 'better-auth'

export const hellocoopClient = () => {
    return {
        id: 'hellocoop-client',
        $InferServerPlugin: {} as ReturnType<typeof hellocoop>,
        pathMethods: {
            '/hellocoop/sign-in': 'POST',
        },
        getActions: ($fetch) => ({
            signInWithHello: async (
                options: {
                    callbackURL?: string
                    errorCallbackURL?: string
                    newUserCallbackURL?: string
                    disableRedirect?: boolean
                    scopes?: string[]
                    providerHint?: string
                    domainHint?: string
                    loginHint?: string
                    prompt?: string
                    requestSignUp?: boolean
                } = {},
            ) => {
                return $fetch('/hellocoop/sign-in', {
                    method: 'POST',
                    body: {
                        ...options,
                    },
                })
            },
        }),
    } satisfies BetterAuthClientPlugin
}
