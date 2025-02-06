// test server for @hellocoop/express package

require('dotenv').config()
const express = require('express')
// const https = require('https');
// const fs = require('fs');

const {
    helloAuth,
    redirect,
    unauthorized,
    setAuth,
} = require('@hellocoop/express')
const config = require('./hello.config')

const app = express()
const port = 3000 // default port to listen

// // SSL certificate setup
// const privateKey = fs.readFileSync('./key.pem', 'utf8');
// const certificate = fs.readFileSync('./cert.pem', 'utf8');
// const credentials = { key: privateKey, cert: certificate };

app.use(helloAuth(config))

app.get('/', async (req, res) => {
    res.json(await req.getAuth())
})

app.get('/redirect', redirect('/'), async (req, res) => {
    res.json(await req.getAuth())
})

app.get('/unauthorized', unauthorized, async (req, res) => {
    res.json(await req.getAuth())
})

app.get('/setAuth', setAuth, (req, res) => {
    res.json(req.auth)
})

app.get('/post-test', (req, res) => {
    const params = Object.entries(req.query)
        .map(
            ([key, value]) =>
                `<input type="hidden" name="${key}" value="${value}">`,
        )
        .join('')

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Auto Submit Form</title>
        </head>
        <body>
            <form id="autoForm" action="http://127.0.0.1:3000/api/hellocoop" method="POST">
                ${params}
            </form>
            
            <script>
                window.onload = function() {
                    document.getElementById("autoForm").submit();
                };
            </script>
        </body>
        </html>
    `)
})
// Create HTTP server
app.listen(port, () => {
    console.log(`HTTP server listening on port:${port}`)
})

// https.createServer(credentials, app).listen(port, () => {
//     console.log(`HTTPS server listening on port:${port}`);
// });
