# @hellocoop/better-auth

A Better Auth plugin for seamless integration with [Hellō](https://hello.dev) - the fastest way to add identity to your application.

## Installation

```bash
npm install @hellocoop/better-auth
```

## Setup

### 1. Get your Hellō Client ID

**Option 1: Quick CLI Setup**

```bash
npx @hellocoop/quickstart
```

This will open your browser, log you into Hellō, prompt you for your app name, and output your `client_id`. Set `clientId` to this value in the third step.

**Option 2: Web Console Setup**

Visit [console.hello.coop](https://console.hello.coop), log into Hellō and create your application and obtain your Client ID which is the `clientId` in the third step.

### 2. Redirect URI

The `http://localhost*` redirect URI is enabled by default, allowing you to immediately start development on your machine.

When you are ready to deploy to staging or production environments, you can configure both development and production redirect URIs at [console.hello.coop](https://console.hello.coop).

### 3. Add the plugin to your auth config

To use the Hellō Better Auth plugin, add it to your auth config.

```ts
// auth.ts
import { betterAuth } from 'better-auth'
import { hellocoop } from '@hellocoop/better-auth'

export const auth = betterAuth({
    plugins: [
        hellocoop({
            config: {
                // Your Hellō Client ID from previous step
                clientId: 'app_0123456789abcdefghijklmn_xyz', // REQUIRED

                // Default values (can be overridden in signInWithHello calls)
                scopes: ['openid', 'profile'], // OPTIONAL = defaults to openid profile
                callbackURL: '/dashboard', // OPTIONAL - default callback URL
                errorCallbackURL: '/auth-error', // OPTIONAL - default error callback URL
                providerHint: 'email-- github', // OPTIONAL - default provider hint
                // ... See Configuration Options for other settings
            },
        }),
    ],
})
```

### 4. Add the client plugin

Include the Hellō Better Auth client plugin in your authentication client setup:

```ts
// auth-client.ts
import { createAuthClient } from 'better-auth/client'
import { hellocoopClient } from '@hellocoop/better-auth'

export const authClient = createAuthClient({
    plugins: [hellocoopClient()],
})
```

## Provider Hints

Users can choose from over 17 ways to login at Hellō. The default choices are the popular options on a platform. You can control the default providers Hellō offers your users with the providerHint parameter. For example if you target developers and don't want email to be an option, you can use set `providerHint=email-- github gitlab`.

See the [documentation] (https://www.hello.dev/docs/apis/wallet/#provider_hint) for details.

## Sign In and Sign Out

To sign in the user, use the Hellō `signInWithHello()` function:

```ts
authClient.signInWithHello({
    // ... See Configuration Options section
})
```

To sign out the user, use the standard Better Auth `signOut()` function:

```ts
authClient.signOut({
    // Better Auth options:
    fetchOptions: {
        onSuccess: () => {
            window.location.href = "/login" // redirect to login page
        },
    }
}
```

## Hellō Button

Similar to other login providers, Hellō has a standard button layout to provide users a common experience.

### Hellō CSS

Include the Hellō button style in the `<head>` of your HTML document:

```html
<head>
    <!-- ... -->
    <link rel="stylesheet" href="https://cdn.hello.coop/css/hello-btn.css" />
    <head></head>
</head>
```

### Button Styling

You can style the button to fit your application

```tsx
// Apply custom CSS classes
<ContinueButton className="hello-btn-white-on-light hello-btn-hover-flare" />
```

You can explore all the different styles in the [Button Explorer](https://www.hello.dev/docs/buttons/#explorer).

## Examples

### Next.js

```tsx
// layout.tsx
// ...
<head>
    // ...
    <link rel="stylesheet" href="https://cdn.hello.coop/css/hello-btn.css" />
</head>

// login/page.tsx
import { authClient } from './auth-client'
import { ContinueButton } from '@hellocoop/better-auth'

function LoginPage() {
    return (
        {/* ... Content ... */}
        <ContinueButton
            className="hello-btn-hover-flare"
            onClick={() => {
                authClient.signInWithHello()
            }}
        />
    )
}

// dashboard/page.tsx
import { authClient } from './auth-client'

function DashboardPage() {
    return (
        {/* ... Content ... */}
        <button onPress={() => {
            authClient.signOut({
                fetchOptions: {
                    onSuccess: () => {
                        window.location.href = "/login" // redirect to login page
                    },
                },
            });
        }}>
            Sign out
        </button>
    )
}
```

### Astro

```tsx
// src/layouts/Layout.astro
// ...
;<head>
    // ...
    <link rel="stylesheet" href="https://cdn.hello.coop/css/hello-btn.css" />
</head>

// src/pages/login.astro
import { authClient } from '../lib/auth-client'
import { ContinueButton } from '@hellocoop/better-auth'

{
    /* ... Content ... */
}
;<ContinueButton
    className="hello-btn-hover-flare"
    onClick={() => {
        authClient.signInWithHello()
    }}
/>

// src/pages/dashboard.astro
import { authClient } from '../lib/auth-client'

{
    /* ... Content ... */
}
;<button
    onClick={() => {
        authClient.signOut({
            fetchOptions: {
                onSuccess: () => {
                    window.location.href = '/login' // redirect to login page
                },
            },
        })
    }}
>
    Sign out
</button>
```

## Configuration Options

**You can explore the many scopes and authorization request parameters at: <br/>[Hellō Playground](https://playground.hello.dev/).**

| Parameter           | Description                                                                                                                                                        | Default            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| `scope?`            | The user claims you are requesting. [See Hellō Scopes](https://www.hello.dev/docs/scopes/)                                                                         | `openid profile`   |
| `callbackURL?`      | URL to redirect after successful sign-in                                                                                                                           | `/`                |
| `errorCallbackURL?` | URL to redirect if an error occurs                                                                                                                                 | `/error`           |
| `loginHint?`        | A hint for which user account to use. Provides better B2B SSO experience [See login_hint docs](https://www.hello.dev/docs/oidc/request/#openid-connect-parameters) | -                  |
| `prompt?`           | - `login` forces login at preferred provider<br/>- `consent` prompts user to review what is released                                                               | -                  |
| `providerHint?`     | - Overrides default providers shown to user. See [preferred providers](https://www.hello.dev/docs/apis/wallet/#provider_hint).                                     | platform dependent |
| `domainHint?`       | The domain or type of account:<br/> `domain.example`<br/>`managed`<br/>or `personal`                                                                               | -                  |

## Error Handling

Errors handling is done by the [Better Auth Error Handling](https://www.better-auth.com/docs/plugins/generic-oauth#error-handling) unless you provide a `errorCallback` URL.

## Resources

- [Hellō Developer Console](https://console.hello.coop)
- [Provider Hints](https://www.hello.dev/docs)
- [Hellō Button Customization Guide](https://www.hello.dev/docs/buttons/)
- [Hellō Scopes Reference](https://www.hello.dev/docs/scopes/)
- [Better Auth Documentation](https://www.better-auth.com/docs/introduction)

## Support

- **Issues:** [GitHub Issues](https://github.com/hellocoop/packages-js/issues)
- **Community:** [Hellō Slack](https://join.slack.com/t/hello-community/shared_invite/zt-1eccnd2np-qJoOWBkHGnpxvBpCTtaH9g)
