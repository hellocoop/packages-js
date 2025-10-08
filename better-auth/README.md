# @hellocoop/better-auth

A Better Auth plugin for seamless integration with [Hellō](https://hello.dev) - the simple, secure, and privacy-focused authentication service.

## Installation

### 1. Install the plugin

```bash
npm install @hellocoop/better-auth
```

### 2. Get your Hellō Client ID

**Option 1: Quick CLI Setup**

```bash
npx @hellocoop/quickstart
```

This will open your browser, log you into Hellō, prompt you for your app name, and output your `client_id`. Set `clientId` to this value in the next step.

**Option 2: Web Console Setup**
Visit [console.hello.coop](https://console.hello.coop) to create a free application and obtain your Client ID which is the `clientId` in the next step.

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
                clientId: 'app_123_xyz', // REQUIRED - your Hellō Client ID from previous step
                scopes: ['openid', 'profile'], // OPTIONAL - defaults to openid profile
                // other config options
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

## Usage

The Hellō Better Auth plugin provides secure authentication endpoints and utilities. Here's how to implement them:

### Sign-In Flow

#### Basic Sign-In

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

// User will be redirected to Hellō for authentication
```

#### Advanced Sign-In Options

You can also override the configuration options set during setup for each `signInWithHello` call:

```ts
const { data, error } = await authClient.signInWithHello({
    callbackURL: '/dashboard', // OPTIONAL - URL to redirect to after sign in
    errorCallbackURL: '/error-page', // OPTIONAL - URL to redirect to if an error occurs
    scopes: ['openid', 'profile'], // OPTIONAL - defaults to openid profile
    loginHint: 'user@example.com', // OPTIONAL - a hint for which user account to use
    providerHint: 'google-- github', // OPTIONAL - suggest specific providers
})
```

### Configuration Options

#### Better Auth

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

### Auth Callback

The plugin automatically handles the Auth callback at `/api/auth/hellocoop/callback`. No additional setup required.

### Sign-Out

To signout a user, you can use the `signOut` function provided by the `authClient`.

```ts
await authClient.signOut()
```

You can pass `fetchOptions` to redirect onSuccess

```ts
await authClient.signOut({
    fetchOptions: {
        onSuccess: () => {
            router.push('/login') // redirect to login page
        },
    },
})
```

## UI Components

### Hellō Buttons

#### 1. Add the Hellō CSS

Include the Hellō button styles in your HTML document:

```html
<link rel="stylesheet" href="https://cdn.hello.coop/css/hello-btn.css" />
```

#### 2. Use the `<ContinueButton/>` Component

```tsx
import { ContinueButton } from '@hellocoop/better-auth'

function LoginPage() {
    const handleSignIn = async () => {
        const { data, error } = await authClient.signInWithHello({
            callbackURL: '/dashboard',
            errorCallbackURL: '/error-page',
            scopes: ['openid', 'profile', 'email'],
        })

        if (error) {
            console.error('Sign-in failed:', error)
        }
    }

    return (
        <div>
            <h1>Welcome to My App</h1>
            <ContinueButton onClick={handleSignIn}>
                Continue with Hellō
            </ContinueButton>
        </div>
    )
}
```

#### 3. Custom Styling

```tsx
// Apply custom CSS classes
<ContinueButton
    className="hello-btn-white hello-btn-hover-flare"
    onClick={handleSignIn}
>
    Sign in with Hellō
</ContinueButton>
```

See the [complete button customization guide](https://www.hello.dev/docs/buttons/) for more styling options.

## Advanced Usage

### Error Handling

The plugin includes built-in error handling for common OAuth issues. Errors are typically redirected to your application's error page with an appropriate error message in the URL parameters. If the errorCallback URL is not provided, the user will be redirected to Better Auth's default error page.

### Environment Variables

Set up environment variables for different environments:

```bash
# .env.local
HELLOCOOP_CLIENT_ID=app_123_xyz

# .env.production
HELLOCOOP_CLIENT_ID=app_456_abc
```

```ts
// Use in configuration
hellocoop({
    config: {
        clientId: process.env.HELLOCOOP_CLIENT_ID!,
    },
})
```

## Troubleshooting

### Common Issues

**Issue: "Invalid OAuth configuration" error**

- **Solution:** Ensure your `clientId` is correct and the application is properly configured in [console.hello.coop](https://console.hello.coop)

**Issue: Callback URL not working**

- **Solution:** Verify your redirect URI in the Hellō console matches your application's callback URL format: `https://yourdomain.com/api/auth/hellocoop/callback`

**Issue: Button styles not loading**

- **Solution:** Ensure you've included the Hellō CSS: `<link rel="stylesheet" href="https://cdn.hello.coop/css/hello-btn.css" />`

## Examples & Resources

- [Complete Demo Application](https://github.com/hellocoop/better-auth-demo)
- [Hellō Developer Console](https://console.hello.coop)
- [Hellō Documentation](https://www.hello.dev/docs)
- [Button Customization Guide](https://www.hello.dev/docs/buttons/)
- [OAuth Scopes Reference](https://www.hello.dev/docs/scopes/)

## Support

- **Issues:** [GitHub Issues](https://github.com/hellocoop/packages-js/issues)
- **Documentation:** [hello.dev/docs](https://www.hello.dev/docs)
- **Community:** [Hellō Discord](https://join.slack.com/t/hello-community/shared_invite/zt-1eccnd2np-qJoOWBkHGnpxvBpCTtaH9g)
