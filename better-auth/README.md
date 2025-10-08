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

This will open your browser, log you into Hellō, prompt you for your app name, and output your `client_id`. Set `clientId` to this value in the next step.

**Option 2: Web Console Setup**
Visit [console.hello.coop](https://console.hello.coop) to create a free application and obtain your Client ID which is the `clientId` in the next step.

### 2. Redirect URI

The localhost Redirect URI is enabled by default enabling you to start development on your machine.

You will need to configure your Redirect URIs for development and production when you deploy your app.

### 3. Add the plugin to your auth config

To use the Hellō Better Auth plugin, add it to your auth config.

```ts
// auth.ts
import { betterAuth } from 'better-auth'
import { hellocoop } from '@hellocoop/better-auth'

export const auth = betterAuth({
    plugins: [
        hellocoop({
            config: { TODO sort out
                // your Hellō Client ID from previous step
                clientId: 'app_0123456789abcdefghijklmn_xyz', // REQUIRED
                scopes: ['openid', 'profile'],
                // OPTIONAL - defaults to openid profile
                providerHint: 'email-- github',
                // OPTIONAL - see Provider Hints
                // other config options
            },
        }),
    ],
})
```

### 4. Add the client plugin

Include the Hellō Better Auth client plugin in your authentication client setup: TODO Better Auth docs

```ts
// auth-client.ts
import { createAuthClient } from 'better-auth/client'
import { hellocoopClient } from '@hellocoop/better-auth'

export const authClient = createAuthClient({
    plugins: [hellocoopClient()],
})
```

## Provider Hints

TBD

## API ???

### Sign In

### Sign Out

## Hellō Button

- Add the Hellō CSS

Include the Hellō button styles in your HTML document:

```html
<link rel="stylesheet" href="https://cdn.hello.coop/css/hello-btn.css" />
```

### Custom Styling

```tsx
// Apply custom CSS classes
<ContinueButton
    className="hello-btn-white hello-btn-hover-flare"
    onClick={handleSignIn}
/>
```

See the [complete button customization guide](https://www.hello.dev/docs/buttons/) for more styling options.

## Example Usage

### NextJS:

_Sign In_

```tsx
// instructions on how CSS relates
import { ContinueButton } from '@hellocoop/better-auth'

function LoginPage() {
    const handleSignIn = async () => {
        const { data, error } = await authClient.signInWithHello({
            callbackURL: '/dashboard', // override default
            errorCallbackURL: '/error-page', // user cancelled override default
        })

        if (error) {
            // TBD - how is this different from errorCallbackURl code path
            console.error('Sign-in failed:', error)
        }
    }

    const { xxx, xxx, xxx } = data

    return (
        <div>
            <h1>TODO --- </h1>
            <ContinueButton onClick={handleSignIn} />
        </div>
    )
}
```

```ts
import { ContinueButton } from '@hellocoop/better-auth'

// complete example code

await authClient.signOut()
```

The Hellō Better Auth plugin provides sign in and sign out endpoints:

```ts
// Initiate the sign-in process
const { data, error } = await authClient.signInWithHello({
    callbackURL: '/dashboard',
    errorCallbackURL: '/error-page',
})

if (error) {
    console.error('Sign-in failed:', error)
    return
}

const { xxx, xxx, xxx } = data
```

### Sign-Out

To sign out the user, you use the standard Better Auth `signOut()` function: TODO - add link to Better Auth docs

## Configuration Options

| Parameter           | Description                                                                                                                                                                                     | Type     | Default                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------- |
| **Beter Auth**      |                                                                                                                                                                                                 |          |
| `callbackURL?`      | URL to redirect after successful sign-in                                                                                                                                                        | `string` | `/`                                                      |
| `errorCallbackURL?` | URL to redirect if an error occurs                                                                                                                                                              | `string` | `/error`                                                 |
| **Open ID**         |                                                                                                                                                                                                 |          |
| `loginHint?`        | A hint for which user account to use. [See login_hint docs](https://www.hello.dev/docs/oidc/request/#openid-connect-parameters)                                                                 | `string` | -                                                        |
| `prompt?`           | `login` forces fresh login; `consent` shows consent screen for profile updates                                                                                                                  | `string` | -                                                        |
| **Hellō**           |                                                                                                                                                                                                 |          |
| `providerHint?`     | Space separated list of [preferred providers](https://www.hello.dev/docs/apis/wallet/#provider_hint) to show new users                                                                          | `string` | `apple/microsoft` depending on the OS and `google email` |
| `domainHint?`       | A hint for which domain or type of account (`domain.example`, `managed`, or `personal`) [See domain_hint domain](https://www.hello.dev/docs/oidc/request/#hell%C5%8D-parameters) for user login | `string` | -                                                        |

## Advanced Usage

### Error Handling

The plugin includes built-in error handling for common OAuth issues. Errors are typically redirected to your application's error page with an appropriate error message in the URL parameters. If the errorCallback URL is not provided, the user will be redirected to Better Auth's default error page.

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
