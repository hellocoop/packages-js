#!/usr/bin/env node
import 'dotenv/config'
import qs from './index.js'

const err = await qs()
if (err) exit(1)
