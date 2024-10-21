export function redirectURIBounce() {
    return `
        <html>
            <head>
                <script>
                    const baseURL = window.location.href.split("?")[0]
                    const searchParams = new URLSearchParams(window.location.search)
                    searchParams.set("redirect_uri", window.location.origin + window.location.pathname)
                    window.location.href = baseURL + '?' + searchParams.toString()
                </script>
            </head>
        </html>
    `
}