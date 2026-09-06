// Marks dist/cjs as CommonJS, overriding the package root's "type": "module"
// so tsc's CommonJS output isn't misinterpreted as ESM by Node's resolver.
const fs = require('fs')
fs.writeFileSync(
    'dist/cjs/package.json',
    JSON.stringify({ type: 'commonjs' }) + '\n',
)
