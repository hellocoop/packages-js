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

```ts
const { data, error } = await authClient.signInWithHello({
    callbackURL: '/dashboard',
    errorCallbackURL: '/error-page',
    scopes: ['openid', 'profile', 'email'],
    prompt: 'consent', // Force consent screen
    providerHint: 'google,github', // Suggest specific providers
    loginHint: 'user@example.com', // Pre-fill email
    domainHint: 'company.com', // Suggest domain for login
})
```

### Configuration Options

| Parameter           | Description                                                                                                            | Type       | Default      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------- | ------------ |
| `callbackURL?`      | URL to redirect after successful sign-in                                                                               | `string`   | `/`          |
| `errorCallbackURL?` | URL to redirect if an error occurs                                                                                     | `string`   | `/error`     |
| `scopes?`           | Array of scopes to request. [See supported scopes](https://www.hello.dev/docs/scopes/)                                 | `string[]` | `['openid']` |
| `providerHint?`     | Comma-separated list of [preferred providers](https://www.hello.dev/docs/apis/wallet/#provider_hint) to show new users | `string`   | -            |
| `loginHint?`        | [Pre-fill email](https://www.hello.dev/docs/oidc/request/#openid-connect-parameters) in the login form                 | `string`   | -            |
| `domainHint?`       | [Suggest domain](https://www.hello.dev/docs/apis/wallet/#domain_hint) for user login                                   | `string`   | -            |
| `prompt?`           | `login` forces fresh login; `consent` shows consent screen for profile updates                                         | `string`   | -            |

### Auth Callback

The plugin automatically handles the Auth callback at `/api/auth/hellocoop/callback`. No additional setup required.

### Sign-Out

#### Basic Sign-Out

```ts
// Sign out the current user
await authClient.signOut()
```

#### Sign-Out with Redirect

```ts
await authClient.signOut({
    fetchOptions: {
        onSuccess: () => {
            // Redirect after successful sign-out
            window.location.href = '/login'
        },
        onError: (error) => {
            console.error('Sign-out failed:', error)
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

#### 2. Use the ContinueButton Component

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

**Available Button Styles:**

- `hello-btn-black` - Black button (default)
- `hello-btn-white` - White button
- `hello-btn-hover-glow` - Glow effect on hover
- `hello-btn-hover-flare` - Flare effect on hover

See the [complete button customization guide](https://www.hello.dev/docs/buttons/) for more styling options.

> **Note:** Advanced theming properties from `@hellocoop/react` are coming soon. Currently, use CSS classes via the `className` prop for customization.

## Configuration Reference

### Plugin Configuration

Configure the Hellō plugin with these options:

```ts
interface HellocoopConfig {
    /** Your Hellō application client ID (required) */
    clientId: string

    /** OAuth scopes to request (optional) */
    scopes?: string[]

    /** Authentication prompt behavior (optional) */
    prompt?: 'login' | 'consent'

    /** Enable PKCE for enhanced security (optional, defaults to true) */
    pkce?: boolean
}
```

### Configuration Options Explained

| Option     | Type                   | Default      | Description                                                                            |
| ---------- | ---------------------- | ------------ | -------------------------------------------------------------------------------------- |
| `clientId` | `string`               | **Required** | Your Hellō application client ID from [console.hello.coop](https://console.hello.coop) |
| `scopes`   | `string[]`             | `['openid']` | OAuth scopes to request. [See available scopes](https://www.hello.dev/docs/scopes/)    |
| `prompt`   | `'login' \| 'consent'` | `undefined`  | `login` forces fresh authentication; `consent` shows profile update screen             |
| `pkce`     | `boolean`              | `true`       | Enables PKCE (Proof Key for Code Exchange) for enhanced security                       |

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

### Debug Mode

Enable debug logging to troubleshoot issues:

```ts
export const auth = betterAuth({
    logger: {
        level: 'debug', // Enable debug logs
    },
    plugins: [
        hellocoop({
            /* config */
        }),
    ],
})
```

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
