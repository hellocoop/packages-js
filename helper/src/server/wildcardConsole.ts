export interface WildCard {
    uri: string
    targetURI: string
    appName: string
    redirectURI: string
}
export function wildcardConsole({
    uri,
    targetURI,
    appName,
    redirectURI,
}: WildCard) {
    return `
        <html>
            <head>
                <meta charset="UTF-8" />
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
                    }
                    h1, p {
                        font-size: 18px;
                    }
                    h1 {
                        font-weight: 100;
                    }
                    p {
                        font-weight: 500;
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
                    }
                    a {
                        text-decoration: none;
                        color: inherit;
                        font-weight: 100;
                    }
                    a:hover, a:focus {
                        text-decoration: underline;
                    }
                    button {
                        color: #d4d4d4;
                        font-size: inherit;
                        background-color: #303030;
                        border-radius: 0.375rem;
                        display: inline-block;
                        padding: 12px 24px;
                        border: 2px solid #808080;
                        cursor: pointer;
                        margin-bottom: 20px;
                    }
                </style>
                <script>
                    function addToRedirectURI(){
                        window.open("${uri}", "_blank")
                        window.location.href = "${targetURI}"
                    }
                </script>
            </head>
            <body>
                <header>Hellō</header>
                <main>
                    <h1>The following Redirect URI is not configured for</h1>
                    <p>
                        <span>${appName}</span><br/>
                        <span>${redirectURI}</span><br/>
                    </p>
                    <button onClick="addToRedirectURI()">Add to Redirect URIs</button><br/>
                    <a href="${targetURI}">Do this later</a>
                </main>
            </body>
        </html>
    `
}
