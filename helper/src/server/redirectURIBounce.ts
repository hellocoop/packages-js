export function redirectURIBounce(safeParams: Record<string, string> = {}) {
    const paramString = JSON.stringify(safeParams)
    return `
        <html>
            <head>
                <script>
                    try {
                        const baseURL = window.location.href.split("?")[0]
                        const safeParams = new URLSearchParams(${paramString})
                        safeParams.set("redirect_uri", window.location.origin + window.location.pathname)
                        window.location.href = baseURL + '?' + safeParams.toString()
                    } catch (error) {
                        console.error('URL processing failed:', error)
                        window.location.href = window.location.origin + window.location.pathname + '?op=login&redirect_uri=' + encodeURIComponent(window.location.origin + window.location.pathname)
                    }
                </script>
            </head>
            <body>
                <p>Discovering redirect URI...</p>
            </body>
        </html>
    `
}
