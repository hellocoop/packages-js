# @hellocoop/better-auth

A Better Auth plugin for seamless integration with [Hellō](https://hello.dev) - the simple, secure, and privacy-focused authentication service.

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

Visit [console.hello.coop](https://console.hello.coop) to create a free application and obtain your Client ID which is the `clientId` in the third step.

### 2. Redirect URI

The localhost redirect URI is enabled by default, allowing you to start development on your machine.

You’ll need to configure your redirect URIs for both development and production when you deploy your app.

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
                // Defaults to openid profile
                scopes: ['openid', 'profile'], // OPTIONAL

                // Default values (can be overridden in signInWithHello calls)
                callbackURL: '/dashboard', // OPTIONAL - default callback URL
                errorCallbackURL: '/auth-error', // OPTIONAL - default error callback URL
                providerHint: 'email-- github', // OPTIONAL - default provider hint
                domainHint: 'managed', // OPTIONAL - default domain hint
                loginHint: 'user@example.com', // OPTIONAL - default login hint
                prompt: 'login', // OPTIONAL - default prompt behavior

                // ... See Configuration Options for other OAuth settings
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

See [Better Auth Plugins](https://www.better-auth.com/docs/concepts/plugins#using-a-plugin) for more information.

## Provider Hints

When Hellō does not know the user's preferred provider (new user or new browser), they are presented with a recommended list of providers to choose from, with the option to show all the other supported providers.

You can change which providers are recommended by setting the `providerHint` property in the configuration option like in the third step. See all the supported provider hint values [here](https://www.hello.dev/docs/apis/wallet/#provider_hint).

## API

### Sign In

To sign in the user, you use the Hellō `signInWithHello()` function:

```ts
authClient.signInWithHello({
    // ... See Configuration Options section
})
```

### Sign Out

To sign out the user, you use the standard Better Auth `signOut()` function:

```ts
authClient.signOut({
    // ... See configuration options:
    // https://www.better-auth.com/docs/basic-usage#signout
})
```

## Hellō Button

#### - Add the Hellō CSS

Include the Hellō button style in your `<head>` of your HTML document:

```html
<head>
    <!-- ... -->
    <link rel="stylesheet" href="https://cdn.hello.coop/css/hello-btn.css" />
    <head></head>
</head>
```

#### - Usage and Styling

```tsx
// Apply custom CSS classes
<ContinueButton className="hello-btn-white-on-light hello-btn-hover-flare" />
```

See the [complete button customization guide](https://www.hello.dev/docs/buttons/) for more styling options.

## Example Usage

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
                authClient.signInWithHello({
                        callbackURL: '/dashboard',
                        errorCallbackURL: '/error-page',
                        providerHint: 'google apple',
                        loginHint: 'specific-user@example.com',
                })
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
        authClient.signInWithHello({
            callbackURL: '/dashboard',
            errorCallbackURL: '/error-page',
            providerHint: 'google apple',
            loginHint: 'specific-user@example.com',
        })
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

## Configuration and Runtime Override Behavior

The following parameters can be configured in both the plugin config and the `signInWithHello` function. When specified in both places, the runtime parameter in `signInWithHello` takes precedence over the config default:

- `callbackURL` - URL to redirect to after successful sign-in
- `errorCallbackURL` - URL to redirect to if an error occurs
- `loginHint` - Hint for which user account to use
- `prompt` - OAuth prompt parameter (`login`, `consent`, etc.)
- `providerHint` - Space-separated list of preferred providers
- `domainHint` - Domain or account type hint

**Example:**

```ts
// Config defaults
hellocoop({
    config: {
        clientId: 'app_0123456789abcdefghijklmn_xyz',
        callbackURL: '/dashboard',
        providerHint: 'google email',
    },
})

// Runtime override
authClient.signInWithHello({
    callbackURL: '/custom-dashboard', // Overrides config default
    loginHint: 'user@example.com', // Uses runtime value
    // providerHint not specified, so uses config default 'google email'
})
```

## Configuration Options

| Parameter           | Description                                                                                                                                                                                     | Type     | Default                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------- |
| `callbackURL?`      | URL to redirect after successful sign-in                                                                                                                                                        | `string` | `/`                                                      |
| `errorCallbackURL?` | URL to redirect if an error occurs                                                                                                                                                              | `string` | `/error`                                                 |
| `loginHint?`        | A hint for which user account to use. [See login_hint docs](https://www.hello.dev/docs/oidc/request/#openid-connect-parameters)                                                                 | `string` | -                                                        |
| `prompt?`           | `login` forces fresh login; `consent` shows consent screen for profile updates                                                                                                                  | `string` | -                                                        |
| `providerHint?`     | Space separated list of [preferred providers](https://www.hello.dev/docs/apis/wallet/#provider_hint) to show new users                                                                          | `string` | `apple/microsoft` depending on the OS and `google email` |
| `domainHint?`       | A hint for which domain or type of account (`domain.example`, `managed`, or `personal`) [See domain_hint domain](https://www.hello.dev/docs/oidc/request/#hell%C5%8D-parameters) for user login | `string` | -                                                        |

## Advanced Usage

### Error Handling

The plugin includes built-in error handling for common OAuth issues. Errors are typically redirected to your application's error page with an appropriate error message in the URL parameters. If the `errorCallback` URL is not provided, the user will be redirected to Better Auth's default error page.

## Resources

- [Complete Demo Application](https://github.com/hellocoop/better-auth-demo)
- [Hellō Developer Console](https://console.hello.coop)
- [Provider Hints](https://www.hello.dev/docs)
- [Button Customization Guide](https://www.hello.dev/docs/buttons/)
- [OAuth Scopes Reference](https://www.hello.dev/docs/scopes/)

## Support

- **Issues:** [GitHub Issues](https://github.com/hellocoop/packages-js/issues)
- **Documentation:** [hello.dev/docs](https://www.hello.dev/docs)
- **Community:** [Hellō Discord](https://join.slack.com/t/hello-community/shared_invite/zt-1eccnd2np-qJoOWBkHGnpxvBpCTtaH9g)
