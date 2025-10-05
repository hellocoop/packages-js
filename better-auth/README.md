# @hellocoop/better-auth

Better Auth plugin for [Hellō](https://hello.dev) - Add privacy-first authentication to your app in minutes.

## Features

- 🔐 **No client secret required** - Uses PKCE flow for enhanced security
- ✅ **Verified claims** - All data from Hellō is verified (email, phone, social accounts)
- 🌐 **Multi-provider** - Support for 15+ login providers (GitHub, Google, Discord, etc.)
- 🎯 **Provider customization** - Control which login providers are shown and in what order
- 🔗 **Rich integrations** - Verified GitHub, Discord, GitLab, Twitter usernames and IDs
- ⚡ **Ethereum support** - Verified Ethereum addresses
- 🌍 **Multi-language** - Hellō UI supports 14+ languages automatically
- 🎨 **Type-safe** - Full TypeScript support

## Installation

```bash
npm install @hellocoop/better-auth better-auth
```

## Quick Start

### 1. Get your Hellō Client ID

Visit [console.hello.coop](https://console.hello.coop) to create a free application and get your `client_id`.

### 2. Server Setup

```typescript
import { betterAuth } from 'better-auth'
import { hellocoop } from '@hellocoop/better-auth'

export const auth = betterAuth({
    plugins: [
        hellocoop({
            clientId: process.env.HELLO_CLIENT_ID,
            // No client secret needed! Hellō uses PKCE
        }),
    ],
})
```

### 3. Client Setup

```typescript
import { createAuthClient } from 'better-auth/client'
import { hellocoopClient } from '@hellocoop/better-auth/client'

const authClient = createAuthClient({
    plugins: [hellocoopClient()],
})

// Sign in with Hellō
await authClient.signIn.oauth2({
    providerId: 'hellocoop',
    callbackURL: '/dashboard',
})
```

## Configuration

### Server Plugin Options

```typescript
hellocoop({
  // Required: Your Hellō client ID
  clientId: string

  // Optional: Additional scopes beyond defaults
  // Default: ["openid", "email", "name", "picture"]
  scopes?: Scope[]

  // Optional: Custom redirect URI
  redirectURI?: string

  // Optional: Default provider hint (can be overridden per sign-in)
  // Examples: "github google", ["discord", "github"], "google--" (demote)
  defaultProviderHint?: string | ProviderHint[]

  // Optional: Default domain hint
  // Examples: "hello.coop", "managed", "personal"
  defaultDomainHint?: string

  // Optional: Default login hint
  // Examples: "user@example.com", "sub_01234567..."
  defaultLoginHint?: string

  // Optional: Default prompt value
  // Examples: "login", "consent", "login consent"
  defaultPrompt?: string
})
```

## Available Scopes

### Standard Scopes

| Scope                | Description                               |
| -------------------- | ----------------------------------------- |
| `openid`             | Required - returns `sub` (unique user ID) |
| `email`              | Verified email address                    |
| `name`               | Full/legal name                           |
| `nickname`           | Preferred name                            |
| `given_name`         | First name                                |
| `family_name`        | Last name                                 |
| `phone`              | Verified phone number                     |
| `picture`            | Profile picture URL                       |
| `profile`            | Combines name, email, and picture         |
| `preferred_username` | Preferred username                        |

### Social Account Scopes (Verified)

| Scope     | Description                      |
| --------- | -------------------------------- |
| `github`  | Verified GitHub username and ID  |
| `discord` | Verified Discord username and ID |
| `gitlab`  | Verified GitLab username and ID  |
| `twitter` | Verified Twitter username and ID |

### Other Scopes

| Scope            | Description               |
| ---------------- | ------------------------- |
| `ethereum`       | Verified Ethereum address |
| `profile_update` | For incremental consent   |

See [Hellō Scopes Documentation](https://www.hello.dev/docs/scopes/) for details.

## Advanced Usage

### Custom Scopes

```typescript
hellocoop({
    clientId: process.env.HELLO_CLIENT_ID,
    scopes: ['openid', 'email', 'name', 'github', 'discord'],
})
```

### Provider Hint

Control which login providers are shown and in what order:

```typescript
hellocoop({
    clientId: process.env.HELLO_CLIENT_ID,
    // Prefer GitHub and Google
    defaultProviderHint: ['github', 'google'],
})

// Or demote a default provider
hellocoop({
    clientId: process.env.HELLO_CLIENT_ID,
    defaultProviderHint: 'google--', // Demote Google
})
```

Available providers: `apple`, `discord`, `facebook`, `github`, `gitlab`, `google`, `twitch`, `twitter`, `tumblr`, `mastodon`, `microsoft`, `line`, `wordpress`, `yahoo`, `phone`, `ethereum`, `qrcode`

### Domain Hint

Require specific account types:

```typescript
hellocoop({
    clientId: process.env.HELLO_CLIENT_ID,
    defaultDomainHint: 'managed', // Require managed/enterprise accounts
})

// Or require personal accounts
hellocoop({
    clientId: process.env.HELLO_CLIENT_ID,
    defaultDomainHint: 'personal',
})

// Or specify a domain
hellocoop({
    clientId: process.env.HELLO_CLIENT_ID,
    defaultDomainHint: 'hello.coop',
})
```

### Login Hint

Suggest which account to use:

```typescript
hellocoop({
    clientId: process.env.HELLO_CLIENT_ID,
    defaultLoginHint: 'user@example.com',
})
```

### Prompt

Control re-authentication and consent:

```typescript
hellocoop({
    clientId: process.env.HELLO_CLIENT_ID,
    // Require re-authentication
    defaultPrompt: 'login',
})

// Or require consent review
hellocoop({
    clientId: process.env.HELLO_CLIENT_ID,
    defaultPrompt: 'consent',
})

// Or both
hellocoop({
    clientId: process.env.HELLO_CLIENT_ID,
    defaultPrompt: 'login consent',
})
```

## Client Usage

### Basic Sign-In

```typescript
import { createAuthClient } from 'better-auth/client'
import { hellocoopClient } from '@hellocoop/better-auth/client'

const authClient = createAuthClient({
    plugins: [hellocoopClient()],
})

// Standard OAuth2 sign-in
await authClient.signIn.oauth2({
    providerId: 'hellocoop',
    callbackURL: '/dashboard',
})
```

### Sign-In with Hellō-Specific Options

```typescript
// Override defaults per sign-in
await authClient.hello.signIn({
    providerHint: 'discord',
    domainHint: 'personal',
    loginHint: 'user@example.com',
    prompt: 'login consent',
    callbackURL: '/dashboard',
})
```

### Sign-In with Specific Provider

```typescript
// Direct sign-in with a specific provider
await authClient.hello.signInWith('github', {
    callbackURL: '/dashboard',
})
```

### Using Scope Constants

```typescript
import { HELLO_SCOPES, HELLO_PROVIDERS } from '@hellocoop/better-auth/client'

// Use constants for type safety
await authClient.hello.signIn({
    providerHint: HELLO_PROVIDERS.GITHUB,
    scopes: [HELLO_SCOPES.EMAIL, HELLO_SCOPES.GITHUB],
    callbackURL: '/dashboard',
})
```

## User Profile Mapping

The plugin automatically maps Hellō claims to the Better Auth user model:

```typescript
{
  id: string                    // sub
  email: string                 // email (always verified)
  emailVerified: boolean        // true
  name: string                  // name
  image: string                 // picture
  nickname?: string             // nickname
  preferredUsername?: string    // preferred_username
  givenName?: string            // given_name
  familyName?: string           // family_name
  phone?: string                // phone
  phoneVerified?: boolean       // phone_verified
  // Social accounts (if requested)
  github?: { id: string, username: string }
  discord?: { id: string, username: string }
  gitlab?: { id: string, username: string }
  twitter?: { id: string, username: string }
  // Other
  ethereum?: string
  org?: { id: string, domain: string }
}
```

## Third Party Initiated Login

Hellō supports OpenID Connect Third Party Initiated Login for features like invitations.

Your application needs to handle the `initiate_login_uri` endpoint that receives:

- `iss` - Hellō issuer (https://issuer.hello.coop)
- `login_hint` - Optional email or user sub
- `domain_hint` - Optional domain requirement
- `target_link_uri` - Optional target after authentication

Refer to the [Hellō Invite API documentation](https://www.hello.dev/docs/apis/invite/) for details.

## Resources

- [Hellō Documentation](https://www.hello.dev/docs/)
- [Hellō Console](https://console.hello.coop)
- [Hellō Scopes](https://www.hello.dev/docs/scopes/)
- [Hellō Wallet API](https://www.hello.dev/docs/apis/wallet/)
- [Better Auth Documentation](https://www.better-auth.com/docs/introduction)

## Why Hellō?

- **Privacy-first**: Users control what information is shared
- **No passwords**: Eliminate password management and security risks
- **Verified data**: All claims are verified at the source
- **Developer-friendly**: Simple integration, no complex OAuth flows
- **Multi-language**: Automatic UI localization for global users
- **Free**: No cost for most applications

## License

MIT

## Support

- [GitHub Issues](https://github.com/hellocoop/packages/issues)
- [Hellō Documentation](https://www.hello.dev/docs/)
- Email: contact@hello.coop
