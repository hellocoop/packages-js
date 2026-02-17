// Diagnostic handler for "OpenID Connect cookie lost" errors.
//
// This handler is reached after the diagnostic bounce page (oidcCookieDiagnostic)
// redirects here with the browser's actual URL as the redirect_uri parameter.
//
// The typical scenario:
// 1. App runs behind a proxy/CDN (e.g., CloudFlare → Firebase Hosting → Cloud Run)
// 2. HOST/HELLO_HOST is not set, so the SDK uses redirect URI discovery
// 3. The browser is on domain A, but the server sees domain B due to the proxy
// 4. The OIDC cookie is set on domain A during login
// 5. The callback arrives at domain B, which can't find the cookie set on domain A
// 6. The callback sends the diagnostic bounce to discover domain A
// 7. This handler renders a page explaining the issue and the fix

import { HelloRequest, HelloResponse } from '../types'

const handleDiagnostic = async (req: HelloRequest, res: HelloResponse) => {
    const redirectUri = req.query.redirect_uri
    const uri = Array.isArray(redirectUri) ? redirectUri[0] : redirectUri

    let hostname = ''
    try {
        if (uri) hostname = new URL(uri).hostname
    } catch {
        // ignore parse errors
    }

    console.error(
        `[hellocoop] OIDC cookie lost — diagnostic info:\n` +
        `  Browser URL: ${uri || 'unknown'}\n` +
        `  HOST/HELLO_HOST: not set\n` +
        `  Fix: set HELLO_HOST=${hostname || '<your-domain>'} in your environment`,
    )

    const page = `
        <html>
            <head>
                <meta charset="UTF-8" />
                <title>Hellō — Configuration Required</title>
                <style>
                    body {
                        color: #303030;
                        font-family: sans-serif;
                        text-align: center;
                        padding: 0;
                        margin: 0;
                    }
                    @media (prefers-color-scheme: dark) {
                        body {
                            background-color: #151515;
                            color: #d4d4d4
                        }
                        code {
                            background-color: #303030;
                        }
                    }
                    h1, p {
                        font-size: 18px;
                    }
                    h1 {
                        font-weight: 500;
                    }
                    p {
                        font-weight: 100;
                        line-height: 28px;
                    }
                    header {
                        background-color: #303030;
                        height: 48px;
                        font-size: 20px;
                        font-weight: 600;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        -webkit-font-smoothing: antialiased;
                        color: #d4d4d4;
                    }
                    main {
                        padding: 32px;
                        max-width: 600px;
                        margin: 0 auto;
                        text-align: left;
                    }
                    code {
                        background-color: #f0f0f0;
                        padding: 2px 8px;
                        border-radius: 4px;
                        font-size: 16px;
                    }
                </style>
            </head>
            <body>
                <header>Hellō</header>
                <main>
                    <h1 style="text-align:center">OpenID Connect cookie lost</h1>
                    <p>The browser is on:</p>
                    <p><code>${uri || 'unknown'}</code></p>
                    <p><code>HOST</code> or <code>HELLO_HOST</code> is not configured. Without it, the login cookie may be set on the wrong domain when your app is behind a proxy or CDN.</p>
                    <p>Add to your environment:</p>
                    <p><code>HELLO_HOST=${hostname || '&lt;your-domain&gt;'}</code></p>
                </main>
            </body>
        </html>
    `

    res.send(page)
}

export default handleDiagnostic
