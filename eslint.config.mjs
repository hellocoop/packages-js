import eslint from '@eslint/js'
import prettierConfig from 'eslint-config-prettier'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactPlugin from 'eslint-plugin-react'
import sveltePlugin from 'eslint-plugin-svelte'
import vuePlugin from 'eslint-plugin-vue'

export default [
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    reactPlugin.configs.flat.recommended,
    ...vuePlugin.configs['flat/recommended'],
    ...sveltePlugin.configs['flat/recommended'],
    prettierConfig, // Disable ESLint rules that conflict with Prettier
    {
        ignores: ['**/dist', '**/node_modules', '**/.svelte-kit', 'archive*/'],
    },
    {
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.mocha,
                ...globals.worker,
                ...globals.browser,
            },
        },
    },
    {
        settings: {
            react: {
                version: 'detect',
            },
        },
    },
]
