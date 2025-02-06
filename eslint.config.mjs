import eslint from '@eslint/js'
import prettierConfig from 'eslint-config-prettier'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import vuePlugin from 'eslint-plugin-vue'

export default [
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    ...vuePlugin.configs['flat/recommended'],
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
        files: ['**/*.{ts,vue}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: globals.browser,
            parserOptions: {
                parser: tseslint.parser,
            },
        },
    },
    {
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-namespace': 'off',
            '@typescript-eslint/no-unused-expressions': 'off',
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/no-empty-object-type': 'off',
            'vue/require-default-prop': 'off',
            'vue/no-v-html': 'off',
        },
    },
]
