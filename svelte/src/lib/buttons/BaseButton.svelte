<script lang="ts">
    import { routeConfig } from '../Provider.svelte'
    import type { ProviderHint, Scope } from '@hellocoop/definitions'
    import { onMount } from 'svelte'
    import { Button } from '../types.js' // tbd use @hellocoop/definitions (currently, some esm import errors)

    export let label: string = 'ō&nbsp;&nbsp;&nbsp;Continue with Hellō'
    export let style: any = {} //TBD any
    export let color: Button.Color = 'black'
    export let theme: Button.Theme = 'ignore-light'
    export let hover: Button.Hover = 'pop'
    export let scope: Scope[] = []
    // @ts-ignore tbd
    export let update: Button.update = false
    export let targetURI: string = ''
    export let providerHint: ProviderHint[] = []
    export let showLoader: boolean = false
    export let disabled: boolean = false
    export let promptLogin: boolean = false
    export let promptConsent: boolean = false
    export let loginHint: string = ''
    export let domainHint: string = ''

    let checkedForStylesheet: boolean = false

    onMount(() => {
        //check if dev has added Hellō stylesheet to pages with Hellō buttons
        if (typeof window != 'undefined' && !checkedForStylesheet) {
            const hasStylesheet = Array.from(
                document.head.getElementsByTagName('link'),
            ).find(
                (element) =>
                    element.getAttribute('rel') === 'stylesheet' &&
                    element.getAttribute('href')?.startsWith(Button.STYLES_URL),
            )

            if (!hasStylesheet)
                console.warn(
                    'Could not find Hellō stylesheet. Please add to pages with Hellō buttons. See http://hello.dev/docs/buttons/#stylesheet for more info.',
                )

            checkedForStylesheet = true
        }
    })

    let clicked: boolean = false
    const loginRoute = new URL(routeConfig.login, window.location.origin)
    if (scope) loginRoute.searchParams.set('scope', scope.join(' '))

    loginRoute.searchParams.set(
        'target_uri',
        targetURI || window.location.pathname,
    )

    if (update) loginRoute.searchParams.set('prompt', 'consent')

    if (promptLogin && promptConsent) {
        loginRoute.searchParams.set('prompt', 'login consent')
    } else if (promptLogin) {
        loginRoute.searchParams.set('prompt', 'login')
    } else if (promptConsent) {
        loginRoute.searchParams.set('prompt', 'consent')
    }

    if (loginHint) loginRoute.searchParams.set('login_hint', loginHint)

    if (domainHint) loginRoute.searchParams.set('login_hint', domainHint)

    if (providerHint)
        loginRoute.searchParams.set('provider_hint', providerHint.join(' '))

    const onClickHandler = (): void => {
        clicked = true
        window.location.href = loginRoute.href
    }
</script>

<button
    on:click={onClickHandler}
    class="hello-btn {Button.CLASS_MAPPING[color]?.[theme]} {Button
        .HOVER_MAPPING[hover]}"
    class:hello-btn-loader={showLoader || clicked}
    disabled={disabled || clicked}
    {style}
>
    {@html label}
</button>
