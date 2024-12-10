<script setup lang="ts">
  import { ref } from 'vue'
  import { routeConfig } from "../provider.js"
  import { Button, type ProviderHint, type Scope } from '../types' // tbd use @hellocoop/definitions (currently, some esm import errors)
  import { onMounted } from 'vue'

  let checkedForStylesheet = false;

  onMounted(() => {
    //check if dev has added Hellō stylesheet to pages with Hellō buttons
    if(typeof window != 'undefined' && !checkedForStylesheet) {
        const hasStylesheet = Array.from(document.head.getElementsByTagName('link')).find(
            (element) =>
                element.getAttribute('rel') === 'stylesheet' &&
                element.getAttribute('href')?.startsWith(Button.STYLES_URL)
        )

        if(!hasStylesheet)
            console.warn('Could not find Hellō stylesheet. Please add to pages with Hellō buttons. See http://hello.dev/docs/buttons/#stylesheet for more info.')

        checkedForStylesheet = true
    }
  })
  
  const clicked = ref(false)

  type Props = {
    label?: string
    style?: any
    color?: Button.Color
    theme?: Button.Theme
    hover?: Button.Hover
    scope?: Scope[]
    update?: Button.Update
    targetURI?: string
    providerHint?: ProviderHint[]
    showLoader?: boolean
    disabled?: boolean,
    promptLogin?: boolean,
    promptConsent?: boolean,
    loginHint?: string,
    domainHint?: string,
  }
  
  const props = withDefaults(defineProps<Props>(), {
    label: "ō&nbsp;&nbsp;&nbsp;Continue with Hellō",
    color: "black",
    theme: "ignore-light",
    hover: "pop",
    showLoader: false,
    disabled: false,
    promptLogin: false,
    promptConsent: false,
    loginHint: "",
    domainHint: ""
  })

  const loginRoute = new URL(routeConfig.login, window.location.origin)

  if(props.scope)
    loginRoute.searchParams.set("scope", props.scope.join(" "))

  loginRoute.searchParams.set("target_uri", props.targetURI || window.location.pathname)
  
  if(props.update)
    loginRoute.searchParams.set("prompt", "consent")

  if (props.promptLogin && props.promptConsent) {
    loginRoute.searchParams.set("prompt", "login consent")
  } else if (props.promptLogin) {
    loginRoute.searchParams.set("prompt", "login")
  } else if (props.promptConsent) {
    loginRoute.searchParams.set("prompt", "consent")
  }

  if (props.loginHint)
    loginRoute.searchParams.set("login_hint", props.loginHint)
  
  if (props.domainHint)
    loginRoute.searchParams.set("login_hint", props.domainHint)

  if(props.providerHint)
    loginRoute.searchParams.set("provider_hint", props.providerHint.join(" "))
  
  const onClickHandler = (): void => {
    clicked.value = true
    window.location.href = loginRoute.href
  }
</script>

<template>
  <button
    @click="onClickHandler"
    :class="['hello-btn', Button.CLASS_MAPPING[props.color]?.[props.theme], Button.HOVER_MAPPING[hover], (showLoader || clicked) && 'hello-btn-loader']"
    :disabled="props.disabled || clicked"
    :style="style"
  >
    <span v-html="label"></span>
  </button>
</template>