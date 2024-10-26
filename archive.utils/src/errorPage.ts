export interface ErrorPageParams {
    target_uri: string
    error: string
    error_description?: string
    error_uri?: string
}

export function errorPage( { error, error_description, error_uri, target_uri }: ErrorPageParams ) {
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
                    }
                    a {
                        text-decoration: none;
                    }
                    a:not(.link-btn) {
                        text-decoration: underline;
                        color: inherit;
                        font-weight: 100;
                    }
                    .link-btn {
                        color: #d4d4d4;
                        font-size: inherit;
                        background-color: #303030;
                        border-radius: 0.375rem;
                        display: inline-block;
                        padding: 12px 48px;
                        border: 2px solid #808080;
                        cursor: pointer;
                        margin: 20px auto;
                    }
                </style>
            </head>
            <body>
                <header>Hellō</header>
                <main>
                    <h1>Error: ${error}</h1>
                    ${error_description && `<p>${error_description}</p>`}
                    ${error_uri && `<a href="${error_uri}">Learn more</a><br/>`}
                    <a href="${target_uri}" class="link-btn">Continue</a>
                </main>
            </body>
        </html>
    `
}