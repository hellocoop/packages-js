import baseConfig from '../eslint.config.mjs'
import sveltePlugin from 'eslint-plugin-svelte'
import * as svelteParser from 'svelte-eslint-parser'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default [
    ...baseConfig,
    ...sveltePlugin.configs['flat/recommended'],
    {
        languageOptions: {
            globals: {
                ...globals.worker,
                ...globals.browser,
            },
        },
    },
    {
        files: ['**/*.svelte'],
        languageOptions: {
            parser: svelteParser,
            parserOptions: {
                parser: tseslint.parser,
                project: './svelte/tsconfig.json',
                extraFileExtensions: ['.svelte'],
            },
        },
    },
    {
        rules: {
            'svelte/no-at-html-tags': 'off',
        },
    },
]
