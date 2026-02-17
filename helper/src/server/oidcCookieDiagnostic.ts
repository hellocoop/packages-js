// Diagnostic bounce page for "OpenID Connect cookie lost" errors.
//
// When HOST/HELLO_HOST is not set, the SDK uses a redirect URI discovery bounce
// (redirectURIBounce) to determine the browser's actual URL. If the app runs
// behind a proxy/CDN (e.g., CloudFlare → Firebase Hosting → Cloud Run), the
// browser may be on a different domain than what the server sees. The OIDC cookie
// gets set on the domain the browser was on during login, but if the proxy changes
// the apparent domain between login and callback, the cookie is set on the wrong
// domain and the callback can't find it.
//
// This bounce page discovers the browser's actual URL and redirects to the
// diagnostic handler, which shows the developer what went wrong and how to fix it.

export function oidcCookieDiagnostic(): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Diagnosing...</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div class="spinner"></div><script>try{const base=window.location.origin+window.location.pathname;window.location.href=base+'?op=diagnostic&redirect_uri='+encodeURIComponent(base)}catch(e){document.body.innerHTML='<p>Diagnostic redirect failed: '+e.message+'</p>'}</script><style>body{height:100%;min-width:320px;overflow-x:auto;overflow-y:hidden}body{font-family:sans-serif;display:flex;align-items:center;justify-content:center}.spinner{position:absolute;left:50%;top:50%;height:40px;width:40px;margin:-26px 0 0 -26px;box-sizing:content-box;animation:rotation 1s infinite linear;border-width:6px;border-style:solid;border-radius:100%}@keyframes rotation{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@media(prefers-color-scheme:dark){body{color:#d4d4d4;background:#151515;color-scheme:dark}.spinner{border-color:rgba(116,116,116,0.3);border-top-color:rgb(116,116,116)}}@media(prefers-color-scheme:light){body{color:#303030;background:white;color-scheme:light}.spinner{border-color:rgba(75,75,75,0.3);border-top-color:rgb(75,75,75)}}</style></body></html>`
}
