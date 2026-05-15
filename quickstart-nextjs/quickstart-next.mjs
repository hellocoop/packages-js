#!/usr/bin/env node
import { createRequire } from 'node:module'

if (process.argv.includes('--version')) {
    const pkg = createRequire(import.meta.url)('./package.json')
    console.log(pkg.version)
    process.exit(0)
}

import 'dotenv/config'
import qs from './index.js'

const err = await qs()
if (err) process.exit(1)
