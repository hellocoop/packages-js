// imported first so env is set before ../src/lib/config.ts reads process.env
// at module load

process.env.HELLO_COOKIE_SECRET =
    '66c71f55568f7b0c3b30cb6a8df9975b5125000caa775240b2e76eb96c43715e'
// ensure the command endpoint is derived from the request Host header
delete process.env.HOST
delete process.env.HELLO_HOST

export {}
