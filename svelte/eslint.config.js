import baseConfig from '../eslint.config.mjs'
import sveltePlugin from 'eslint-plugin-svelte'
import * as svelteParser from 'svelte-eslint-parser'
import tseslint from 'typescript-eslint'
import globals from 'globals'
import prettierConfig from 'eslint-config-prettier'

export default [
    ...baseConfig,
    ...sveltePlugin.configs['flat/recommended'],
    prettierConfig, // Disable ESLint rules that conflict with Prettier
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
