export default function (client_id) {
    return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Hellō Quickstart Result</title>
        <style>
            * { padding: 0; margin: 0; border: none; box-sizing: border-box; }
            html, body { height: 100%; }
            @media (prefers-color-scheme: dark) {
                body { background-color: #151515; }
                body, header, #client-id { color: #d4d4d4 !important; }
            }
        </style>
      </head>
      <body style="display: flex; flex-direction: column; color: #303030; font-family: ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif;">
        <header style="background-color: #303030; color: white; height: 48px; display: flex; justify-content: center; align-items: center; font-size: 1.25rem; font-weight: 600;">Hellō Quickstart Complete</header>
        <main style="flex: 1; padding: 24px; display: flex; flex-direction: column; align-items: center;">
            <p style="margin: 48px 0; font-size: 26px;">you may now close this window</p>
        </main>
      </body>
    </html>`
}
